import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pickDefaultLeagueId } from "@/lib/default-league";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/onboarding");
  }

  const { data: memberships } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", user.id);

  const leagueId = pickDefaultLeagueId(
    (memberships ?? []).map((m) => m.league_id),
  );

  if (leagueId) {
    redirect(`/league/${leagueId}`);
  }

  redirect("/league/choose");
}
