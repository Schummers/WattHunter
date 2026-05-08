// apps/web/lib/gt-stages.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { GT_SCHEDULES } from "./gt-stage-schedule";

export interface GtStage {
  number: number;
  date: string; // ISO date
  slug: string; // e.g., "race/giro-d-italia/2026/stage-3"
  status: "past" | "today" | "upcoming";
  hasTacticActive?: boolean; // for the calling team
}

/**
 * Get upcoming stages of a GT phase from the static schedule,
 * annotated with whether the team has already placed a tactic on each.
 */
export async function getGtStages(
  supabase: SupabaseClient<Database>,
  opts: { phaseId: 4 | 6 | 8; year: number; teamId: string }
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
  }));

  // Annotate with hasTacticActive
  const { data: tactics } = await supabase
    .from("gt_tactic_activations")
    .select("stage_slug")
    .eq("team_id", opts.teamId)
    .eq("phase_id", opts.phaseId)
    .eq("year", opts.year);

  const activeSlugs = new Set((tactics ?? []).map((t) => t.stage_slug));
  for (const s of stages) {
    if (activeSlugs.has(s.slug)) s.hasTacticActive = true;
  }

  return stages.filter((s) => s.status !== "past");
}

function phaseToGtSlug(phaseId: 4 | 6 | 8): string {
  return { 4: "giro-d-italia", 6: "tour-de-france", 8: "vuelta-a-espana" }[phaseId];
}

function stageStatus(dateIso: string): "past" | "today" | "upcoming" {
  const today = new Date().toISOString().slice(0, 10);
  if (dateIso < today) return "past";
  if (dateIso === today) return "today";
  return "upcoming";
}
