"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentPhase } from "@/lib/phases";
import { calcTransferBonus, RELEASE_FEE } from "@/lib/format";

/**
 * Release a rider immediately.
 *
 * Rules:
 *   - Flat fee: 5 000 EUR, deducted immediately
 *   - Transfer bonus if rider appreciated (current min salary > locked salary)
 *   - Lock: cannot release a rider recruited during the current phase
 *   - Contract set to 'released' immediately, rider returns to pool
 */
export async function releaseRider(contractId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch contract + team + rider data in one query
  const { data: contract } = await supabase
    .from("contracts")
    .select(
      "id, team_id, rider_id, status, locked_salary, phase_recruited_id, " +
      "teams:team_id(user_id, treasury, league_id), " +
      "riders:rider_id(pcs_points_1yr)"
    )
    .eq("id", contractId)
    .single() as { data: {
      id: string; team_id: string; rider_id: string; status: string;
      locked_salary: number; phase_recruited_id: number | null;
      teams: { user_id: string; treasury: number; league_id: string } | { user_id: string; treasury: number; league_id: string }[];
      riders: { pcs_points_1yr: number | null } | { pcs_points_1yr: number | null }[];
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

  const treasury = (team as { treasury: number }).treasury;
  const leagueId = (team as { league_id: string }).league_id;

  // Check treasury can cover release fee
  if (treasury < RELEASE_FEE) {
    return { error: "Insufficient treasury for release fee (5 000 EUR required)" };
  }

  // Calculate transfer bonus
  const rider = Array.isArray(contract.riders) ? contract.riders[0] : contract.riders;
  const pcsPoints = (rider as { pcs_points_1yr: number | null })?.pcs_points_1yr ?? 0;
  const transferBonus = calcTransferBonus(pcsPoints, contract.locked_salary);

  const now = new Date().toISOString();

  // 1. Update contract to released
  const { error: contractErr } = await supabase
    .from("contracts")
    .update({ status: "released", released_at: now })
    .eq("id", contractId);

  if (contractErr) return { error: contractErr.message };

  // 2. Deduct release fee
  await supabase.from("treasury_log").insert({
    team_id: contract.team_id,
    type: "release_fee",
    amount: -RELEASE_FEE,
    description: "Release fee (flat 5 000 EUR)",
    rider_id: contract.rider_id,
  });

  // 3. Credit transfer bonus (if any)
  if (transferBonus > 0) {
    await supabase.from("treasury_log").insert({
      team_id: contract.team_id,
      type: "transfer_bonus",
      amount: transferBonus,
      description: `Transfer bonus for rider (min salary appreciated)`,
      rider_id: contract.rider_id,
    });
  }

  // 4. Update treasury: -fee +bonus
  const newTreasury = treasury - RELEASE_FEE + transferBonus;
  await supabase
    .from("teams")
    .update({ treasury: newTreasury })
    .eq("id", contract.team_id);

  revalidatePath(`/league/${leagueId}`);
  return { success: true, transferBonus, releaseFee: RELEASE_FEE };
}
