"use server";

import { createClient } from "@/lib/supabase/server";
import { getOpenAuction } from "@/lib/supabase/get-open-auction";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const SaveSponsorSchema = z.object({
  teamId: z.uuid(),
  sponsorId: z.uuid(),
});

/**
 * Save sponsor selection.
 *
 * Two modes:
 *   - First sponsor (no existing team_sponsors row): immediate upsert (no payment — payday handled separately)
 *   - Change sponsor (has existing): sets teams.pending_sponsor_id, effective at next payday
 */
export async function saveSponsor(input: { teamId: string; sponsorId: string }) {
  const parsed = SaveSponsorSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: "Invalid input" };
  }

  const { teamId, sponsorId } = parsed.data;
  const supabase = await createClient();

  // Verify team ownership
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Not authenticated" };

  const { data: team } = await supabase
    .from("teams")
    .select("id, level, league_id, treasury")
    .eq("id", teamId)
    .eq("user_id", user.id)
    .single();

  if (!team) return { success: false as const, error: "Team not found" };

  // Verify sponsor exists and is unlocked
  const { data: sponsor } = await supabase
    .from("sponsors")
    .select("id, name, unlock_level, monthly_budget")
    .eq("id", sponsorId)
    .single();

  if (!sponsor) return { success: false as const, error: "Sponsor not found" };
  if (sponsor.unlock_level > team.level) {
    return { success: false as const, error: `Requires level ${sponsor.unlock_level}` };
  }

  // Check if team already has a sponsor
  const { data: existingSponsor } = await supabase
    .from("team_sponsors")
    .select("id, sponsor_id")
    .eq("team_id", teamId)
    .maybeSingle();

  if (!existingSponsor) {
    // --- First sponsor selection (onboarding) ---
    // Immediate upsert — no payment credited here, payday handled separately
    await supabase.from("team_sponsors").insert({
      team_id: teamId,
      sponsor_id: sponsorId,
      activated_at: new Date().toISOString(),
    });

    revalidatePath(`/league/${team.league_id}`);
    return { success: true as const, sponsorName: sponsor.name, immediate: true };
  }

  // --- Sponsor change ---
  if (existingSponsor.sponsor_id === sponsorId) {
    return { success: false as const, error: "Already your active sponsor" };
  }

  // Check if there is an open auction (immediate change) or not (pending until next phase)
  const openAuction = await getOpenAuction(supabase, team.league_id);
  const isImmediate = !!openAuction;

  if (isImmediate) {
    // Round 1: immediate effect — replace active sponsor
    await supabase
      .from("team_sponsors")
      .update({ sponsor_id: sponsorId, activated_at: new Date().toISOString() })
      .eq("team_id", teamId);

    // Clear any pending if set
    await supabase
      .from("teams")
      .update({ pending_sponsor_id: null })
      .eq("id", teamId);

    revalidatePath(`/league/${team.league_id}`);
    return { success: true as const, sponsorName: sponsor.name, immediate: true };
  }

  // Round 2+ or between phases: save as pending, effective next phase
  await supabase
    .from("teams")
    .update({ pending_sponsor_id: sponsorId })
    .eq("id", teamId);

  revalidatePath(`/league/${team.league_id}`);
  return { success: true as const, sponsorName: sponsor.name, pending: true };
}
