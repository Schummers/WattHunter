"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function launchFirstAuction(leagueId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non authentifie." };
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("id, commissioner_id, status")
    .eq("id", leagueId)
    .single();

  if (!league || league.commissioner_id !== user.id) {
    return { error: "Seul le commissaire peut lancer la premiere enchere." };
  }

  if (league.status !== "pending") {
    return { error: "La ligue a deja demarre." };
  }

  const now = new Date();
  const closesAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  const { error: auctionError } = await supabase.from("auctions").insert({
    league_id: leagueId,
    name: `Pre-Saison ${now.getFullYear()}`,
    status: "open",
    opens_at: now.toISOString(),
    closes_at: closesAt.toISOString(),
  });

  if (auctionError) {
    return { error: "Erreur lors de la creation de l'enchere." };
  }

  await supabase
    .from("leagues")
    .update({ status: "active" })
    .eq("id", leagueId);

  revalidatePath(`/league/${leagueId}`);
  return { success: true };
}
