import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { loadPalmares } from "@/lib/palmares/load";
import { DEMO_LEAGUE_SLUG } from "@/lib/demo-constants";
import { PalmaresClient } from "./palmares-client";

/**
 * The palmares is cross-league and cross-season by nature, but it lives under a
 * league route so it keeps the game layout and its navigation entry. Nothing on
 * this page is scoped to `leagueId`.
 */
export default async function PalmaresPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();
  const seasonYear = new Date().getFullYear();

  if (leagueId === DEMO_LEAGUE_SLUG) {
    const data = await loadPalmares(supabase, { seasonYear });
    return <PalmaresClient data={data} />;
  }

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
