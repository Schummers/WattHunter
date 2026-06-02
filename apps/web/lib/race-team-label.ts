import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getCurrentGTPhase, GT_SHORT_NAME, type GtPhaseId } from "@/lib/gt-phases";

/**
 * Server-side resolver for the "Race Team" sub-tab label and the Race Team
 * page title.
 *
 * Currently returns the active GT phase's short label suffixed by " Team"
 * (e.g. "Giro Team", "Tour Team", "Vuelta Team") when a GT is active, or the
 * static fallback "Race Team" otherwise.
 *
 * TODO (follow-up to Spec A A9): detect 1-week stage-race campaigns
 * (Paris-Nice, Dauphiné, Suisse, etc.) from the team's gt_squad rows whose
 * race_slug points at a non-GT stage-race active for `date`. When that
 * helper lands, swap the body so the label becomes e.g. "Paris-Nice Team".
 *
 * The signature already accepts `supabase` and `teamId` so callers don't
 * need to change when we extend coverage.
 */
export async function resolveRaceTeamLabel(
  supabase: SupabaseClient<Database>,
  teamId: string,
  date: Date = new Date(),
): Promise<string> {
  // Currently unused — accepted now so callers stay stable when 1-week race
  // detection is wired in (it will need to query gt_squad/race_campaigns).
  void supabase;
  void teamId;

  const cur = getCurrentGTPhase(date);
  if (!cur) return "Race Team";
  return `${GT_SHORT_NAME[cur.id as GtPhaseId]} Team`;
}
