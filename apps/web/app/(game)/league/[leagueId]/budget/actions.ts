"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const SaveSponsorSchema = z.object({
  teamId: z.uuid(),
  sponsorId: z.uuid(),
});

/**
 * Save sponsor selection — one sponsor per team, immediate effect (next day).
 *
 * Validates:
 *   1. Team belongs to current user
 *   2. Sponsor unlock_level ≤ team.level
 *
 * Upserts team_sponsors row (unique on team_id).
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
    .select("id, level, league_id")
    .eq("id", teamId)
    .eq("user_id", user.id)
    .single();

  if (!team) return { success: false as const, error: "Team not found" };

  // Verify sponsor exists and is unlocked
  const { data: sponsor } = await supabase
    .from("sponsors")
    .select("id, name, unlock_level")
    .eq("id", sponsorId)
    .single();

  if (!sponsor) return { success: false as const, error: "Sponsor not found" };
  if (sponsor.unlock_level > team.level) {
    return { success: false as const, error: `Requires level ${sponsor.unlock_level}` };
  }

  // Upsert team_sponsors (one per team — conflict on team_id unique)
  const { error } = await supabase.from("team_sponsors").upsert(
    {
      team_id: teamId,
      sponsor_id: sponsorId,
      activated_at: new Date().toISOString(),
    },
    { onConflict: "team_id" }
  );

  if (error) return { success: false as const, error: error.message };

  revalidatePath(`/league/${team.league_id}`);
  return { success: true as const, sponsorName: sponsor.name };
}
