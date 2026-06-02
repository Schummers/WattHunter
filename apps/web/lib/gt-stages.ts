// apps/web/lib/gt-stages.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { GT_SCHEDULES } from "./gt-stage-schedule";

export type StageProfileIcon = "p0" | "p1" | "p2" | "p3" | "p4" | "p5";

export interface GtStage {
  number: number;
  date: string; // ISO date
  slug: string; // e.g., "race/giro-d-italia/2026/stage-3"
  status: "past" | "today" | "upcoming";
  hasTacticActive?: boolean; // for the calling team
  isTodayCutoffPassed?: boolean; // true if status==="today" and current time >= 11:00 CET
  /** Pre-race profile from `stage_profiles` (P3a). `null` if not yet seeded. */
  profileIcon?: StageProfileIcon | null;
}

/**
 * Get upcoming stages of a GT phase from the static schedule,
 * annotated with whether the team has already placed a tactic on each
 * and with the pre-race profile_icon from `stage_profiles` (P3a).
 */
export async function getGtStages(
  supabase: SupabaseClient<Database>,
  opts: { phaseId: 4 | 6 | 8; year: number; teamId: string },
): Promise<GtStage[]> {
  const gtSlug = phaseToGtSlug(opts.phaseId);
  const scheduleKey = `${gtSlug}/${opts.year}`;
  const schedule = GT_SCHEDULES[scheduleKey];

  if (!schedule) return [];

  const stages: GtStage[] = schedule.map((entry) => ({
    number: entry.number,
    date: entry.date,
    slug: `race/${gtSlug}/${opts.year}/stage-${entry.number}`,
    status: stageStatus(entry.date),
    profileIcon: null,
  }));

  // Annotate hasTacticActive
  const { data: tactics } = await supabase
    .from("gt_tactic_activations")
    .select("stage_slug")
    .eq("team_id", opts.teamId)
    .eq("phase_id", opts.phaseId)
    .eq("year", opts.year);

  const activeSlugs = new Set((tactics ?? []).map((t) => t.stage_slug));
  const cutoffPassed = isCutoffPassedCET();
  for (const s of stages) {
    if (activeSlugs.has(s.slug)) s.hasTacticActive = true;
    if (s.status === "today") s.isTodayCutoffPassed = cutoffPassed;
  }

  // Annotate profileIcon — single bulk read of stage_profiles (P3a).
  // Forward-only: stages without a row stay `null` and the UI handles it.
  const slugs = stages.map((s) => s.slug);
  if (slugs.length > 0) {
    const { data: profiles } = await supabase
      .from("stage_profiles")
      .select("race_slug, profile_icon")
      .in("race_slug", slugs);
    const byslug = new Map<string, StageProfileIcon>();
    for (const p of profiles ?? []) {
      const icon = p.profile_icon as StageProfileIcon | null;
      if (icon) byslug.set(p.race_slug, icon);
    }
    for (const s of stages) {
      const found = byslug.get(s.slug);
      if (found) s.profileIcon = found;
    }
  }

  return stages.filter((s) => s.status !== "past");
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
