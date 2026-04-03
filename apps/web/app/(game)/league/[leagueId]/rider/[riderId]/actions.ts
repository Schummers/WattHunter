"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentPhase } from "@/lib/phases";

/**
 * Release a rider immediately. Releasing is free — no fee, no transfer bonus.
 * The salary already paid for the current phase is simply lost (not refunded).
 *
 * Rules:
 *   - Lock: cannot release a rider recruited during the current phase
 *   - Contract set to 'released' immediately, rider returns to pool
 *   - Any active draft bids for this rider from this team are deleted
 */
export async function releaseRider(contractId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch contract + team data
  const { data: contract } = await supabase
    .from("contracts")
    .select(
      "id, team_id, rider_id, status, phase_recruited_id, " +
      "teams:team_id(user_id, league_id)"
    )
    .eq("id", contractId)
    .single() as { data: {
      id: string; team_id: string; rider_id: string; status: string;
      phase_recruited_id: number | null;
      teams: { user_id: string; league_id: string } | { user_id: string; league_id: string }[];
    } | null };

  if (!contract) return { error: "Contract not found" };

  const team = Array.isArray(contract.teams) ? contract.teams[0] : contract.teams;
  if ((team as { user_id: string })?.user_id !== user.id) {
    return { error: "Not authorized" };
  }

  if (contract.status !== "active") {
    return { error: "Contract is not active" };
  }

  // Lock: can't release rider recruited this phase
  const currentPhase = getCurrentPhase();
  if (contract.phase_recruited_id === currentPhase.id) {
    return { error: "Cannot release a rider recruited during the current phase" };
  }

  const leagueId = (team as { league_id: string }).league_id;
  const now = new Date().toISOString();

  // 1. Update contract to released
  const { error: contractErr } = await supabase
    .from("contracts")
    .update({ status: "released", released_at: now })
    .eq("id", contractId);

  if (contractErr) return { error: contractErr.message };

  // 2. Delete any active draft bids for this rider from this team
  await supabase
    .from("draft_bids")
    .delete()
    .eq("team_id", contract.team_id)
    .eq("rider_id", contract.rider_id);

  revalidatePath(`/league/${leagueId}`);
  return { success: true };
}
