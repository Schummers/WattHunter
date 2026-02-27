"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const joinLeagueSchema = z.object({
  code: z
    .string()
    .length(6, "Le code doit contenir exactement 6 caracteres.")
    .regex(/^[A-Z2-9]+$/, "Code invalide."),
});

export async function joinLeague(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = (formData.get("code") as string)?.toUpperCase().trim();

  const parsed = joinLeagueSchema.safeParse({ code: raw });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { code } = parsed.data;

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

  // Ensure public.users row exists (trigger handles this normally,
  // but belt-and-suspenders for edge cases like auto-confirm)
  const displayName =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Joueur";
  await supabase
    .from("users")
    .upsert(
      { id: user.id, display_name: displayName, avatar_url: user.user_metadata?.avatar_url ?? null },
      { onConflict: "id" }
    );

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({
      user_id: user.id,
      league_id: league.id,
      name: `Equipe de ${displayName}`,
    })
    .select("id")
    .single();

  if (teamError || !team) {
    console.error("Team creation failed:", teamError);
    return { error: "Erreur lors de la creation de l'equipe." };
  }

  const { error: joinError } = await supabase.from("league_members").insert({
    league_id: league.id,
    user_id: user.id,
    team_id: team.id,
  });

  if (joinError) {
    return { error: "Erreur lors de l'inscription a la ligue." };
  }

  redirect(`/league/${league.id}`);
}
