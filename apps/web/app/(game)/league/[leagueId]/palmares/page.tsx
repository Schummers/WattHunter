import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { loadPalmares } from "@/lib/palmares/load";
import { PalmaresClient } from "./palmares-client";

/**
 * The palmares is cross-league and cross-season by nature, but it lives under a
 * league route so it keeps the game layout and its navigation entry. Nothing on
 * this page is scoped to `leagueId`.
 *
 * No demo path on purpose: this is the private history of one group under their
 * real account names, and the demo league is the public shop window. The RLS on
 * the archive says the same thing (migration 20260914000300).
 */
export default async function PalmaresPage() {
  const supabase = await createClient();
  const seasonYear = new Date().getFullYear();

  const user = await getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const data = await loadPalmares(supabase, {
    seasonYear,
    viewerKey: profile?.display_name ?? null,
  });

  return <PalmaresClient data={data} />;
}
