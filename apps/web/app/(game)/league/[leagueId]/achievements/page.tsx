import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { redirect } from "next/navigation";
import { AchievementsClient } from "./achievements-client";

export default async function AchievementsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  // Membership → team_id + equipped slug
  const { data: membership } = await supabase
    .from("league_members")
    .select("team_id, teams:team_id(equipped_achievement_slug)")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  const team = membership?.teams as { equipped_achievement_slug: string | null } | null;
  const equippedSlug = team?.equipped_achievement_slug ?? null;
  const myTeamId = membership?.team_id ?? null;

  // Unlock detection — query race_results for monuments
  const unlockedSlugs: string[] = [];

  if (myTeamId) {
    const year = new Date().getFullYear();

    const MONUMENT_MAP: Record<string, string> = {
      [`race/paris-roubaix/${year}/result`]:         "paris-roubaix",
      [`race/ronde-van-vlaanderen/${year}/result`]:  "flandres",
      [`race/liege-bastogne-liege/${year}/result`]:  "lbl",
      [`race/il-lombardia/${year}/result`]:          "lombardia",
      [`race/milano-sanremo/${year}/result`]:        "milan-sanremo",
    };

    // Riders that scored for this team on monument races (covers released riders too —
    // ownership is recorded at scoring time, so the palmarès credits whoever owned the
    // rider when they finished).
    const { data: xpRows } = await supabase
      .from("rider_xp_daily")
      .select("race_slug, rider_id")
      .eq("team_id", myTeamId)
      .in("race_slug", Object.keys(MONUMENT_MAP));

    const teamRiderByRace = new Map<string, string[]>();
    for (const row of xpRows ?? []) {
      const list = teamRiderByRace.get(row.race_slug) ?? [];
      list.push(row.rider_id);
      teamRiderByRace.set(row.race_slug, list);
    }

    if (teamRiderByRace.size > 0) {
      const allRiderIds = Array.from(new Set(Array.from(teamRiderByRace.values()).flat()));
      const { data: results } = await supabase
        .from("race_results")
        .select("race_slug, rider_id, rank")
        .in("race_slug", Array.from(teamRiderByRace.keys()))
        .in("rider_id", allRiderIds)
        .lte("rank", 10);

      for (const r of results ?? []) {
        const base = MONUMENT_MAP[r.race_slug];
        if (!base || r.rank == null) continue;
        // Confirm this team actually owned the rider at scoring time
        if (!teamRiderByRace.get(r.race_slug)?.includes(r.rider_id)) continue;
        if (r.rank <= 10) unlockedSlugs.push(`${base}-top10`);
        if (r.rank <= 3)  unlockedSlugs.push(`${base}-podium`);
        if (r.rank === 1) unlockedSlugs.push(`${base}-victory`);
      }
    }
  }

  return (
    <AchievementsClient
      leagueId={leagueId}
      equippedSlug={equippedSlug}
      unlockedSlugs={[...new Set(unlockedSlugs)]}
    />
  );
}
