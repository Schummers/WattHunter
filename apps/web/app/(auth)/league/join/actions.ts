"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function joinLeague(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const code = (formData.get("code") as string)?.toUpperCase().trim();

  if (!code || code.length !== 6) {
    return { error: "Le code doit contenir exactement 6 caracteres." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non authentifie." };
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, status, max_players")
    .eq("invite_code", code)
    .single();

  if (!league) {
    return { error: "Code invalide. Verifiez aupres du commissaire de la ligue." };
  }

  if (league.status === "active") {
    return { error: "Cette ligue a deja demarre. Impossible de la rejoindre." };
  }

  const { data: existingMember } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .single();

  if (existingMember) {
    redirect(`/league/${league.id}`);
  }

  const { count } = await supabase
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("league_id", league.id);

  if (count !== null && count >= league.max_players) {
    return { error: "Cette ligue est pleine." };
  }

  const { data: team } = await supabase
    .from("teams")
    .insert({
      user_id: user.id,
      league_id: league.id,
      name: `Equipe de ${user.user_metadata?.full_name ?? "Joueur"}`,
    })
    .select("id")
    .single();

  const { error: joinError } = await supabase.from("league_members").insert({
    league_id: league.id,
    user_id: user.id,
    team_id: team?.id ?? null,
  });

  if (joinError) {
    return { error: "Erreur lors de l'inscription a la ligue." };
  }

  redirect(`/league/${league.id}`);
}
