"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  const name = formData.get("name") as string;
  const maxPlayers = Number(formData.get("maxPlayers"));

  if (!name || name.trim().length < 2) {
    return { error: "Le nom de la ligue doit contenir au moins 2 caracteres." };
  }
  if (maxPlayers < 6 || maxPlayers > 12) {
    return { error: "Le nombre de joueurs doit etre entre 6 et 12." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non authentifie." };
  }

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
      max_players: maxPlayers,
    })
    .select("id")
    .single();

  if (leagueError || !league) {
    return { error: "Erreur lors de la creation de la ligue." };
  }

  const { data: team } = await supabase
    .from("teams")
    .insert({
      user_id: user.id,
      league_id: league.id,
      name: `Equipe de ${user.user_metadata?.full_name ?? "Commissioner"}`,
    })
    .select("id")
    .single();

  await supabase.from("league_members").insert({
    league_id: league.id,
    user_id: user.id,
    team_id: team?.id ?? null,
  });

  redirect(`/league/${league.id}`);
}
