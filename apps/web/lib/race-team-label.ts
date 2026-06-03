import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { GT_SHORT_NAME } from "@/lib/gt-phases";
import { getCurrentRaceCampaign } from "@/lib/race-campaign";

/**
 * Server-side resolver for the "Race Team" sub-tab label and the Race Team
 * page title.
 *
 * Returns:
 *   - GT active → short label suffixed by " Team" (e.g. "Giro Team").
 *   - 1-week race active (team has a `gt_squad` row whose `race_slug`
 *     points at a stage-race whose calendar window contains `date`) →
 *     short toponym + " Team" (e.g. "Dauphiné Team").
 *   - Else → the static fallback `"Race Team"`.
 *
 * Delegates the detection to {@link getCurrentRaceCampaign} so any future
 * "what race is this team racing now?" caller can share the same logic.
 */
export async function resolveRaceTeamLabel(
  supabase: SupabaseClient<Database>,
  teamId: string,
  date: Date = new Date(),
): Promise<string> {
  const campaign = await getCurrentRaceCampaign(supabase, teamId, date);
  if (!campaign) return "Race Team";
  if (campaign.kind === "gt") {
    return `${GT_SHORT_NAME[campaign.phaseId]} Team`;
  }
  return `${campaign.label} Team`;
}
