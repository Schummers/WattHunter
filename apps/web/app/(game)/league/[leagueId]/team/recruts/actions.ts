"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentPhase } from "@/lib/phases";
import { RELEASE_FEE } from "@/lib/format";

/**
 * Confirm phase setup — triggers payday.
 *
 * Sequence:
 *   1. Apply pending sponsor change (if any)
 *   2. Apply pending policy changes (if any)
 *   3. Credit sponsor income
 *   4. Deduct salaries for all active contracts
 *   5. Update treasury
 *   6. Bankruptcy check (if treasury < -10 000)
 *   7. Mark phase as confirmed
 */
export async function confirmPhaseSetup(teamId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const currentPhase = getCurrentPhase();

  // Fetch team (verifies ownership via RLS)
  const { data: team } = await supabase
    .from("teams")
    .select("id, treasury, league_id, phase_confirmed_id, pending_sponsor_id")
    .eq("id", teamId)
    .eq("user_id", user.id)
    .single();

  if (!team) return { error: "Team not found" };

  // Guard: already confirmed for this phase
  if (team.phase_confirmed_id === currentPhase.id) {
    return { error: "Already confirmed for this phase" };
  }

  let treasury = team.treasury;

  // --- Step 1: Apply pending sponsor change ---
  if (team.pending_sponsor_id) {
    await supabase.from("team_sponsors").upsert(
      {
        team_id: teamId,
        sponsor_id: team.pending_sponsor_id,
        activated_at: new Date().toISOString(),
      },
      { onConflict: "team_id" }
    );

    await supabase
      .from("teams")
      .update({ pending_sponsor_id: null })
      .eq("id", teamId);
  }

  // --- Step 2: Apply pending policy changes ---
  const { data: pendingPolicies } = await supabase
    .from("team_policies")
    .select("id, pending_is_active, pending_config")
    .eq("team_id", teamId)
    .not("pending_is_active", "is", null);

  if (pendingPolicies && pendingPolicies.length > 0) {
    for (const p of pendingPolicies) {
      if (p.pending_is_active === false) {
        // Deactivate: delete the policy row
        await supabase.from("team_policies").delete().eq("id", p.id);
      } else {
        // Activate: apply pending state
        await supabase
          .from("team_policies")
          .update({
            is_active: p.pending_is_active,
            config: p.pending_config,
            activated_at: new Date().toISOString(),
            pending_is_active: null,
            pending_config: null,
          })
          .eq("id", p.id);
      }
    }
  }

  // --- Step 3: Credit sponsor income ---
  const { data: teamSponsor } = await supabase
    .from("team_sponsors")
    .select("sponsor_id, sponsors(id, name, monthly_budget)")
    .eq("team_id", teamId)
    .single();

  const rawSponsor = teamSponsor?.sponsors;
  const sponsor = Array.isArray(rawSponsor) ? rawSponsor[0] : rawSponsor;
  const sponsorBudget = (sponsor as { monthly_budget: number } | undefined)?.monthly_budget ?? 250_000;
  const sponsorName = (sponsor as { name: string } | undefined)?.name ?? "Lotto (default)";

  treasury += sponsorBudget;

  await supabase.from("treasury_log").insert({
    team_id: teamId,
    type: "sponsor_payment",
    amount: sponsorBudget,
    description: `Payday — ${sponsorName} (Phase ${currentPhase.id}: ${currentPhase.label})`,
  });

  // --- Step 4: Deduct salaries ---
  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, rider_id, locked_salary")
    .eq("team_id", teamId)
    .eq("status", "active");

  const totalSalary = (contracts ?? []).reduce(
    (sum, c) => sum + (c.locked_salary ?? 0),
    0
  );

  if (totalSalary > 0) {
    treasury -= totalSalary;

    await supabase.from("treasury_log").insert({
      team_id: teamId,
      type: "payday_salary",
      amount: -totalSalary,
      description: `Payday salaries — ${(contracts ?? []).length} riders (Phase ${currentPhase.id})`,
    });
  }

  // --- Step 5: Update treasury ---
  await supabase
    .from("teams")
    .update({ treasury })
    .eq("id", teamId);

  // --- Step 6: Bankruptcy check ---
  const BANKRUPTCY_THRESHOLD = -10_000;
  const released: string[] = [];

  if (treasury < BANKRUPTCY_THRESHOLD && contracts && contracts.length > 0) {
    // Fetch cumulative XP per rider to determine release order (highest XP first per spec)
    const { data: xpData } = await supabase
      .from("rider_xp_daily")
      .select("rider_id, xp_gained")
      .eq("team_id", teamId);

    const riderXp: Record<string, number> = {};
    for (const row of xpData ?? []) {
      riderXp[row.rider_id] = (riderXp[row.rider_id] ?? 0) + row.xp_gained;
    }

    // Sort by highest cumulative XP first (spec §6)
    const sortedContracts = [...contracts].sort(
      (a, b) => (riderXp[b.rider_id] ?? 0) - (riderXp[a.rider_id] ?? 0)
    );

    for (const contract of sortedContracts) {
      if (treasury >= BANKRUPTCY_THRESHOLD) break;

      // Release contract
      await supabase
        .from("contracts")
        .update({ status: "released", released_at: new Date().toISOString() })
        .eq("id", contract.id);

      // Refund salary
      treasury += contract.locked_salary;

      // Release fee
      treasury -= RELEASE_FEE;

      // Treasury log: release fee
      await supabase.from("treasury_log").insert({
        team_id: teamId,
        type: "release_fee",
        amount: -RELEASE_FEE,
        description: `Bankruptcy release fee — rider ${contract.rider_id}`,
        rider_id: contract.rider_id,
      });

      // Treasury log: salary refund (bankruptcy_release)
      await supabase.from("treasury_log").insert({
        team_id: teamId,
        type: "bankruptcy_release",
        amount: contract.locked_salary,
        description: `Bankruptcy salary refund — rider ${contract.rider_id}`,
        rider_id: contract.rider_id,
      });

      released.push(contract.rider_id);
    }

    // Update treasury after bankruptcy
    await supabase
      .from("teams")
      .update({ treasury })
      .eq("id", teamId);
  }

  // --- Step 7: Mark confirmed ---
  await supabase
    .from("teams")
    .update({
      phase_confirmed_at: new Date().toISOString(),
      phase_confirmed_id: currentPhase.id,
    })
    .eq("id", teamId);

  revalidatePath(`/league/${team.league_id}`);

  return {
    success: true,
    treasuryAfter: treasury,
    sponsorBudget,
    totalSalary,
    released,
    phaseId: currentPhase.id,
    phaseLabel: currentPhase.label,
  };
}
