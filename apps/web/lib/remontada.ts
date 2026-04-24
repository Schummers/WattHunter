// apps/web/lib/remontada.ts
// Anti-Runaway Mechanism 1: Remontada Boost — server-side active boost fetch.
// Spec: docs/plans/2026-04-23-anti-runaway-system-design.md §3

import { createClient } from "@/lib/supabase/server";

export type RemontadaBoost = {
  team_id: string;
  gt_identifier: "giro-d-italia" | "tour-de-france" | "vuelta-a-espana";
  triggered_at_stage: number;
  expires_after_stage: number;
  multiplier: number;
  overtaken_team_name: string | null;
  stages_remaining: number; // derived client-side from current GT stage
};

/** Fetch the active Remontada boost for a team in a specific GT, or null. */
export async function getActiveRemontadaBoost(
  teamId: string,
  gtIdentifier: RemontadaBoost["gt_identifier"],
  currentStageNumber: number,
): Promise<RemontadaBoost | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("remontada_boosts")
    .select(
      `team_id, gt_identifier, triggered_at_stage, expires_after_stage, multiplier,
       overtaken:teams!remontada_boosts_overtaken_team_id_fkey(name)`,
    )
    .eq("team_id", teamId)
    .eq("gt_identifier", gtIdentifier)
    .maybeSingle();

  if (error || !data) return null;

  // Active iff currentStageNumber > triggered_at_stage AND <= expires_after_stage.
  if (
    currentStageNumber <= data.triggered_at_stage ||
    currentStageNumber > data.expires_after_stage
  ) {
    return null;
  }

  return {
    team_id: data.team_id,
    gt_identifier: data.gt_identifier,
    triggered_at_stage: data.triggered_at_stage,
    expires_after_stage: data.expires_after_stage,
    multiplier: Number(data.multiplier),
    overtaken_team_name:
      (data.overtaken as { name?: string } | null)?.name ?? null,
    stages_remaining: data.expires_after_stage - currentStageNumber + 1,
  };
}
