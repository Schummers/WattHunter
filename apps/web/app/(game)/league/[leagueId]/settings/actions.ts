"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateTeamName(teamId: string, name: string) {
  if (!name.trim()) return { error: "Team name cannot be empty" };
  if (name.trim().length < 2) return { error: "Team name must be at least 2 characters" };
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

  const { data, error } = await supabase.rpc("leave_league", {
    p_league_id: leagueId,
  });

  if (error) return { error: error.message };

  const result = data as unknown as { ok?: boolean; error?: string } | null;
  if (!result?.ok) return { error: result?.error ?? "Leave failed" };

  revalidatePath("/league");
  return { success: true };
}

export async function updateUserName(name: string) {
  if (!name.trim()) return { error: "Name cannot be empty" };
  if (name.trim().length < 2) return { error: "Name must be at least 2 characters" };
  if (name.trim().length > 30) return { error: "Name too long (max 30 chars)" };

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
  if (name.trim().length < 2) return { error: "League name must be at least 2 characters" };
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
