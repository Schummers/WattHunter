// apps/web/lib/gt-stages.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { GT_SCHEDULES } from "./gt-stage-schedule";

export type StageProfileIcon = "p0" | "p1" | "p2" | "p3" | "p4" | "p5";
export type StageType = "RR" | "ITT" | "TTT";

export interface GtStage {
  number: number;
  date: string; // ISO date
  slug: string; // e.g., "race/giro-d-italia/2026/stage-3"
  status: "past" | "today" | "upcoming";
  hasTacticActive?: boolean; // for the calling team
  isTodayCutoffPassed?: boolean; // true if status==="today" and current time >= 11:00 CET
  /** Pre-race profile from `stage_profiles` (P3a). `null` if not yet seeded. */
  profileIcon?: StageProfileIcon | null;
  /**
   * Stage type from `stage_profiles.stage_type`. PCS-derived: `"RR"` (road
   * race, default), `"ITT"` (individual TT), `"TTT"` (team TT). Defaults to
   * `"RR"` when missing. Used by the tactic stage list to block Nemesis /
   * Overdrive on time trials.
   */
  stageType?: StageType;
}

export type GetStagesOpts =
  | { teamId: string; phaseId: 4 | 6 | 8; year: number }
  | { teamId: string; raceSlug: string };

/**
 * Get upcoming stages of a race annotated with the team's tactic activations
 * and the pre-race profile_icon from `stage_profiles` (Spec A P3a).
 *
 * Two modes:
 *   - **GT** (`phaseId` + `year`): list of stages comes from the static
 *     `GT_SCHEDULES` table (one entry per stage with a known calendar date).
 *   - **1-week race** (`raceSlug`, e.g. `"race/dauphine/2026"`): list comes
 *     from `stage_profiles` rows whose `race_slug` starts with `raceSlug/stage-`.
 *     1-week races inherit the same status/cutoff/tactic-activation logic.
 */
export async function getGtStages(
  supabase: SupabaseClient<Database>,
  opts: GetStagesOpts,
): Promise<GtStage[]> {
  const stages = await ("raceSlug" in opts
    ? buildOneWeekStages(supabase, opts.raceSlug)
    : Promise.resolve(buildGtStages(opts.phaseId, opts.year)));

  if (stages.length === 0) return [];

  // Annotate hasTacticActive — filter set depends on the mode.
  const activationsQ = supabase
    .from("gt_tactic_activations")
    .select("stage_slug")
    .eq("team_id", opts.teamId);
  const { data: tactics } =
    "raceSlug" in opts
      ? await activationsQ.eq("race_slug", opts.raceSlug)
      : await activationsQ.eq("phase_id", opts.phaseId).eq("year", opts.year);

  const activeSlugs = new Set((tactics ?? []).map((t) => t.stage_slug));
  const cutoffPassed = isCutoffPassedCET();
  for (const s of stages) {
    if (activeSlugs.has(s.slug)) s.hasTacticActive = true;
    if (s.status === "today") s.isTodayCutoffPassed = cutoffPassed;
  }

  // Annotate profileIcon + stageType — single bulk read of stage_profiles.
  // For 1-week races both fields were already loaded in buildOneWeekStages
  // (same query source), so skip the second round-trip when nothing is missing.
  const missing = stages
    .filter((s) => s.profileIcon == null || s.stageType == null)
    .map((s) => s.slug);
  if (missing.length > 0) {
    const { data: profiles } = await supabase
      .from("stage_profiles")
      .select("race_slug, profile_icon, stage_type")
      .in("race_slug", missing);
    type Row = { profile: StageProfileIcon | null; type: StageType };
    const byslug = new Map<string, Row>();
    for (const p of profiles ?? []) {
      byslug.set(p.race_slug, {
        profile: (p.profile_icon as StageProfileIcon | null) ?? null,
        type: (p.stage_type as StageType | null) ?? "RR",
      });
    }
    for (const s of stages) {
      const found = byslug.get(s.slug);
      if (!found) continue;
      if (s.profileIcon == null && found.profile) s.profileIcon = found.profile;
      if (s.stageType == null) s.stageType = found.type;
    }
  }
  // Anything still without a stageType (e.g. unseeded GT stages) defaults to RR.
  for (const s of stages) if (s.stageType == null) s.stageType = "RR";

  return stages.filter((s) => s.status !== "past");
}

function buildGtStages(phaseId: 4 | 6 | 8, year: number): GtStage[] {
  const gtSlug = phaseToGtSlug(phaseId);
  const schedule = GT_SCHEDULES[`${gtSlug}/${year}`];
  if (!schedule) return [];
  return schedule.map((entry) => ({
    number: entry.number,
    date: entry.date,
    slug: `race/${gtSlug}/${year}/stage-${entry.number}`,
    status: stageStatus(entry.date),
    profileIcon: null,
  }));
}

const STAGE_NUM_RE = /\/stage-(\d+)$/;

async function buildOneWeekStages(
  supabase: SupabaseClient<Database>,
  raceSlug: string,
): Promise<GtStage[]> {
  // stage_profiles is the source of truth for 1-week races: it carries
  // race_date (seeded by the startlists pipeline), profile_icon, and stage_type.
  const { data } = await supabase
    .from("stage_profiles")
    .select("race_slug, race_date, profile_icon, stage_type")
    .like("race_slug", `${raceSlug}/stage-%`)
    .order("race_slug", { ascending: true });

  const out: GtStage[] = [];
  for (const row of data ?? []) {
    const match = STAGE_NUM_RE.exec(row.race_slug);
    if (!match || !row.race_date) continue;
    out.push({
      number: parseInt(match[1], 10),
      date: row.race_date,
      slug: row.race_slug,
      status: stageStatus(row.race_date),
      profileIcon: (row.profile_icon as StageProfileIcon | null) ?? null,
      stageType: (row.stage_type as StageType | null) ?? "RR",
    });
  }
  out.sort((a, b) => a.number - b.number);
  return out;
}

function phaseToGtSlug(phaseId: 4 | 6 | 8): string {
  return { 4: "giro-d-italia", 6: "tour-de-france", 8: "vuelta-a-espana" }[phaseId];
}

function isCutoffPassedCET(): boolean {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Paris",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  return h * 60 + m >= 11 * 60;
}

function stageStatus(dateIso: string): "past" | "today" | "upcoming" {
  const today = new Date().toISOString().slice(0, 10);
  if (dateIso < today) return "past";
  if (dateIso === today) return "today";
  return "upcoming";
}
