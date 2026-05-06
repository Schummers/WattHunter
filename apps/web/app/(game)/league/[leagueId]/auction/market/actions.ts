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
  ).max(8, "Cannot configure more than 8 rounds per phase"),
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

  // 5. Update each auction — closes_at = end of day CET only (opens_at is immutable)
  for (const round of rounds) {
    const { error: updateError } = await supabase
      .from("auctions")
      .update({
        closes_at: `${round.date}T23:59:59+01:00`,
      })
      .eq("id", round.auctionId)
      .eq("league_id", leagueId);

    if (updateError) {
      return { error: `Failed to update round ${round.auctionId}: ${updateError.message}` };
    }
  }

  // 6. Revalidate
  revalidatePath(`/league/${leagueId}/auction/market`);

  return { success: true };
}

export async function confirmPhaseSetup(teamId: string) {
  const supabase = await createClient();
  const currentPhase = getCurrentPhase();

  const { data, error } = await supabase.rpc("confirm_phase_setup", {
    p_team_id: teamId,
    p_current_phase_id: currentPhase.id,
    p_current_phase_label: currentPhase.label,
  });

  if (error) return { error: error.message };

  const result = data as { ok?: boolean; error?: string; phaseId?: number; phaseLabel?: string } | null;
  if (!result?.ok) return { error: result?.error ?? "Confirmation failed" };

  revalidatePath("/league");
  return {
    success: true,
    phaseId: result.phaseId,
    phaseLabel: result.phaseLabel,
  };
}
