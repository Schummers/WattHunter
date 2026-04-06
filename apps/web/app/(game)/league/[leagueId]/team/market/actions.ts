"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentPhase, getPhaseRange } from "@/lib/phases";
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// setRoundDates — Race Director only, only before the phase has started
// ---------------------------------------------------------------------------

const SetRoundDatesSchema = z.object({
  leagueId: z.string().uuid(),
  rounds: z.array(
    z.object({
      auctionId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
    })
  ),
});

export async function setRoundDates(input: {
  leagueId: string;
  rounds: { auctionId: string; date: string }[];
}) {
  // 1. Validate input
  const parsed = SetRoundDatesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid input: " + parsed.error.message };
  }
  const { leagueId, rounds } = parsed.data;

  // 2. Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // 3. Verify user is commissioner
  const { data: league } = await supabase
    .from("leagues")
    .select("commissioner_id")
    .eq("id", leagueId)
    .single();

  if (!league) return { error: "League not found" };
  if (league.commissioner_id !== user.id) return { error: "Not authorized" };

  // 4. Verify phase hasn't started yet
  const currentPhase = getCurrentPhase();
  const { start: phaseStart } = getPhaseRange(currentPhase, new Date().getFullYear());
  if (new Date() >= phaseStart) {
    return { error: "Cannot edit round dates after the phase has started" };
  }

  // 5. Update each auction — opens_at = start of day CET, closes_at = end of day CET
  for (const round of rounds) {
    const { error: updateError } = await supabase
      .from("auctions")
      .update({
        opens_at: `${round.date}T00:00:00+01:00`,
        closes_at: `${round.date}T23:59:59+01:00`,
      })
      .eq("id", round.auctionId)
      .eq("league_id", leagueId);

    if (updateError) {
      return { error: `Failed to update round ${round.auctionId}: ${updateError.message}` };
    }
  }

  // 6. Revalidate
  revalidatePath(`/league/${leagueId}/team/market`);

  return { success: true };
}

/**
 * Confirm phase setup — applies sponsor and strategy changes, then marks the phase confirmed.
 * Financial operations (sponsor credit, salary deduction, bankruptcy check) are handled
 * by the payday section in auction.py.
 *
 * Sequence:
 *   1. Apply pending sponsor change (if any)
 *   2. Apply pending strategy changes (if any)
 *   3. Mark phase as confirmed
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
    .select("id, league_id, phase_confirmed_id, pending_sponsor_id")
    .eq("id", teamId)
    .eq("user_id", user.id)
    .single();

  if (!team) return { error: "Team not found" };

  // Guard: already confirmed for this phase
  if (team.phase_confirmed_id === currentPhase.id) {
    return { error: "Already confirmed for this phase" };
  }

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

  // --- Step 2: Apply pending strategy changes ---
  const { data: pendingStrategies } = await supabase
    .from("team_strategies")
    .select("id, pending_is_active, pending_config")
    .eq("team_id", teamId)
    .not("pending_is_active", "is", null);

  if (pendingStrategies && pendingStrategies.length > 0) {
    for (const p of pendingStrategies) {
      if (p.pending_is_active === false) {
        // Deactivate: delete the strategy row
        await supabase.from("team_strategies").delete().eq("id", p.id);
      } else {
        // Activate: apply pending state
        await supabase
          .from("team_strategies")
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

  // --- Step 3: Mark confirmed ---
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
    phaseId: currentPhase.id,
    phaseLabel: currentPhase.label,
  };
}
