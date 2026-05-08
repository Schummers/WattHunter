// apps/web/lib/gt-stages.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface GtStage {
  number: number;
  date: string; // ISO date
  slug: string; // e.g., "race/giro-d-italia/2026/stage-3"
  status: "past" | "today" | "upcoming";
  hasTacticActive?: boolean; // for the calling team
}

/**
 * Get upcoming stages of a GT phase, optionally annotated with whether
 * the team has already placed a tactic on each.
 */
export async function getGtStages(
  supabase: SupabaseClient<Database>,
  opts: { phaseId: 4 | 6 | 8; year: number; teamId: string }
): Promise<GtStage[]> {
  const gtSlug = phaseToGtSlug(opts.phaseId);
  const prefix = `race/${gtSlug}/${opts.year}/stage-`;

  const { data: rows } = await supabase
    .from("race_results")
    .select("race_slug, race_date")
    .like("race_slug", `${prefix}%`)
    .order("race_date");

  if (!rows) return [];

  // Distinct slugs (race_results has multiple rows per stage — one per rider)
  const seen = new Set<string>();
  const stages: GtStage[] = [];
  for (const r of rows) {
    if (seen.has(r.race_slug)) continue;
    seen.add(r.race_slug);
    const num = parseInt(r.race_slug.replace(prefix, ""), 10);
    const status = stageStatus(r.race_date);
    stages.push({
      number: num,
      date: r.race_date,
      slug: r.race_slug,
      status,
    });
  }

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
