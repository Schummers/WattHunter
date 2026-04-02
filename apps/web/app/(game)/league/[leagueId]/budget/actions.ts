"use server";

import { createClient } from "@/lib/supabase/server";
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
 *   - First sponsor (no existing team_sponsors row): immediate upsert + first payment
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
    // Immediate upsert + first payment (this IS the first payday)
    await supabase.from("team_sponsors").insert({
      team_id: teamId,
      sponsor_id: sponsorId,
      activated_at: new Date().toISOString(),
    });

    // First sponsor payment
    const newTreasury = team.treasury + sponsor.monthly_budget;
    await supabase
      .from("teams")
      .update({ treasury: newTreasury })
      .eq("id", teamId);

    await supabase.from("treasury_log").insert({
      team_id: teamId,
      type: "sponsor_payment",
      amount: sponsor.monthly_budget,
      description: `First sponsor payment — ${sponsor.name}`,
    });

    revalidatePath(`/league/${team.league_id}`);
    return { success: true as const, sponsorName: sponsor.name, immediate: true };
  }

  // --- Sponsor change (pending, effective next payday) ---
  if (existingSponsor.sponsor_id === sponsorId) {
    return { success: false as const, error: "Already your active sponsor" };
  }

  await supabase
    .from("teams")
    .update({ pending_sponsor_id: sponsorId })
    .eq("id", teamId);

  revalidatePath(`/league/${team.league_id}`);
  return { success: true as const, sponsorName: sponsor.name, pending: true };
}
