"use server";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { revalidatePath } from "next/cache";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { z } from "zod/v4";

const EquipSchema = z.object({
  leagueId: z.uuid(),
  slug: z.string().min(1).max(100),
});

export async function equipAchievement(leagueId: string, slug: string) {
  const parsed = EquipSchema.safeParse({ leagueId, slug });
  if (!parsed.success) return { error: "Invalid data" };

  // Validate slug exists
  const achievement = ACHIEVEMENTS.find((a) => a.slug === slug);
  if (!achievement) return { error: "Invalid achievement slug" };

  const user = await getUser();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createClient();

  // Get team id for this user in this league
  const { data: membership } = await supabase
    .from("league_members")
    .select("team_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!membership?.team_id) return { error: "Team not found" };

  const { error } = await supabase
    .from("teams")
    .update({ equipped_achievement_slug: slug })
    .eq("id", membership.team_id);

  if (error) return { error: "Failed to update achievement" };

  revalidatePath(`/league/${leagueId}/achievements`);
  revalidatePath(`/league/${leagueId}`);
  revalidatePath(`/league/${leagueId}/ranking`);
  return { success: true };
}
