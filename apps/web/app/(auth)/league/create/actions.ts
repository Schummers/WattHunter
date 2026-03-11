"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createLeagueSchema = z.object({
  name: z.string().min(2, "League name must be at least 2 characters.").max(50),
});

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createLeague(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const parsed = createLeagueSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { name } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  // Ensure public.users row exists BEFORE league insert (FK constraint)
  const displayName =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Player";
  await supabase
    .from("users")
    .upsert(
      { id: user.id, display_name: displayName, avatar_url: user.user_metadata?.avatar_url ?? null },
      { onConflict: "id" }
    );

  let inviteCode = generateInviteCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from("leagues")
      .select("id")
      .eq("invite_code", inviteCode)
      .single();
    if (!existing) break;
    inviteCode = generateInviteCode();
    attempts++;
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .insert({
      name: name.trim(),
      invite_code: inviteCode,
      commissioner_id: user.id,
      max_players: 20,
    })
    .select("id")
    .single();

  if (leagueError || !league) {
    console.error("League creation failed:", leagueError);
    return { error: `Failed to create league: ${leagueError?.message ?? "unknown"}` };
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({
      user_id: user.id,
      league_id: league.id,
      name: displayName,
    })
    .select("id")
    .single();

  if (teamError || !team) {
    console.error("Team creation failed:", teamError);
    return { error: "Failed to create team." };
  }

  // Auto-assign Lotto (T1) as default secondary sponsor
  const { data: lotto } = await supabase
    .from("sponsors")
    .select("id")
    .eq("name", "Lotto")
    .single();

  if (lotto) {
    await supabase
      .from("team_sponsors")
      .insert({ team_id: team.id, sponsor_id: lotto.id, slot: "secondary" });
  }

  const { error: memberError } = await supabase.from("league_members").insert({
    league_id: league.id,
    user_id: user.id,
    team_id: team.id,
  });

  if (memberError) {
    return { error: "Failed to join league." };
  }

  redirect(`/league/${league.id}`);
}
