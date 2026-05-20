"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const UpdateTeamNameSchema = z.object({
  teamId: z.string().uuid(),
  name: z.string().trim().min(2).max(30),
});

const LeaveLeagueSchema = z.object({
  leagueId: z.string().uuid(),
});

const UpdateUserNameSchema = z.object({
  name: z.string().trim().min(2).max(30),
});

const UpdateUserEmailSchema = z.object({
  email: z.string().trim().email(),
});

const UpdateLeagueNameSchema = z.object({
  leagueId: z.string().uuid(),
  name: z.string().trim().min(2).max(50),
});

export async function updateTeamName(teamId: string, name: string) {
  const parsed = UpdateTeamNameSchema.safeParse({ teamId, name });
  if (!parsed.success) return { error: "Invalid data" };

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
    .update({ name: parsed.data.name })
    .eq("id", teamId);

  if (error) return { error: error.message };

  revalidatePath("/league");
  return { success: true };
}

export async function leaveLeague(leagueId: string) {
  const parsed = LeaveLeagueSchema.safeParse({ leagueId });
  if (!parsed.success) return { error: "Invalid data" };

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
  const parsed = UpdateUserNameSchema.safeParse({ name });
  if (!parsed.success) return { error: "Invalid data" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: { full_name: parsed.data.name },
  });

  if (error) return { error: error.message };

  revalidatePath("/league");
  return { success: true };
}

export async function updateUserEmail(email: string) {
  const parsed = UpdateUserEmailSchema.safeParse({ email });
  if (!parsed.success) return { error: "Invalid data" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email: parsed.data.email });

  if (error) return { error: error.message };

  revalidatePath("/league");
  return { success: true };
}

export async function updateLeagueName(leagueId: string, name: string) {
  const parsed = UpdateLeagueNameSchema.safeParse({ leagueId, name });
  if (!parsed.success) return { error: "Invalid data" };

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
    .update({ name: parsed.data.name })
    .eq("id", leagueId);

  if (error) return { error: error.message };

  revalidatePath("/league");
  return { success: true };
}
