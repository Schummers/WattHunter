"use server";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { revalidatePath } from "next/cache";
import { ACHIEVEMENTS } from "@/lib/achievements";

export async function equipAchievement(leagueId: string, slug: string) {
  // Validate slug exists
  const achievement = ACHIEVEMENTS.find((a) => a.slug === slug);
  if (!achievement) throw new Error("Invalid achievement slug");

  const user = await getUser();
  if (!user) throw new Error("Unauthorized");

  const supabase = await createClient();

  // Get team id for this user in this league
  const { data: membership } = await supabase
    .from("league_members")
    .select("team_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!membership?.team_id) throw new Error("Team not found");

  const { error } = await supabase
    .from("teams")
    .update({ equipped_achievement_slug: slug })
    .eq("id", membership.team_id);

  if (error) throw error;

  revalidatePath(`/league/${leagueId}/achievements`);
  revalidatePath(`/league/${leagueId}`);
  revalidatePath(`/league/${leagueId}/ranking`);
}
