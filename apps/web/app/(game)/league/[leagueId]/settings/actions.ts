"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateTeamName(teamId: string, name: string) {
  if (!name.trim()) return { error: "Team name cannot be empty" };
  if (name.trim().length > 30) return { error: "Team name too long (max 30 chars)" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify ownership
  const { data: team } = await supabase
    .from("teams")
    .select("id, user_id")
    .eq("id", teamId)
    .single();

  if (!team || team.user_id !== user.id) return { error: "Not authorized" };

  const { error } = await supabase
    .from("teams")
    .update({ name: name.trim() })
    .eq("id", teamId);

  if (error) return { error: error.message };

  revalidatePath("/league");
  return { success: true };
}

export async function leaveLeague(leagueId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Check if user is commissioner — can't leave own league
  const { data: league } = await supabase
    .from("leagues")
    .select("commissioner_id")
    .eq("id", leagueId)
    .single();

  if (league?.commissioner_id === user.id) {
    return { error: "Race Directors cannot leave their own league" };
  }

  // Get user's team in this league
  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("user_id", user.id)
    .eq("league_id", leagueId)
    .single();

  if (!team) return { error: "Team not found" };

  // Check for active contracts — block if any exist
  const { count: activeContracts } = await supabase
    .from("contracts")
    .select("id", { count: "exact", head: true })
    .eq("team_id", team.id)
    .in("status", ["active", "notice"]);

  if (activeContracts && activeContracts > 0) {
    return { error: "Release all riders before leaving the league" };
  }

  // Cleanup: cancel active bids, remove team sponsors, team policies
  await supabase
    .from("auction_bids")
    .update({ status: "cancelled" })
    .eq("team_id", team.id)
    .eq("status", "active");

  await supabase
    .from("team_sponsors")
    .delete()
    .eq("team_id", team.id);

  await supabase
    .from("team_policies")
    .delete()
    .eq("team_id", team.id);

  // Delete team
  await supabase
    .from("teams")
    .delete()
    .eq("id", team.id);

  // Remove league membership
  const { error } = await supabase
    .from("league_members")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/league");
  return { success: true };
}

export async function updateUserName(name: string) {
  if (!name.trim()) return { error: "Name cannot be empty" };
  if (name.trim().length > 50) return { error: "Name too long (max 50 chars)" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: { full_name: name.trim() },
  });

  if (error) return { error: error.message };

  revalidatePath("/league");
  return { success: true };
}

export async function updateUserEmail(email: string) {
  if (!email.trim()) return { error: "Email cannot be empty" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email: email.trim() });

  if (error) return { error: error.message };

  revalidatePath("/league");
  return { success: true };
}

export async function updateLeagueName(leagueId: string, name: string) {
  if (!name.trim()) return { error: "League name cannot be empty" };
  if (name.trim().length > 50) return { error: "League name too long (max 50 chars)" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify commissioner
  const { data: league } = await supabase
    .from("leagues")
    .select("commissioner_id")
    .eq("id", leagueId)
    .single();

  if (!league || league.commissioner_id !== user.id) {
    return { error: "Only the Race Director can rename the league" };
  }

  const { error } = await supabase
    .from("leagues")
    .update({ name: name.trim() })
    .eq("id", leagueId);

  if (error) return { error: error.message };

  revalidatePath("/league");
  return { success: true };
}
