import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RankingClient } from "./ranking-client";

export default async function RankingPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get current user's team_id
  const { data: member } = await supabase
    .from("league_members")
    .select("id, team_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    redirect("/league/choose");
  }

  const myTeamId = member.team_id;

  // All teams in league ordered by cumulative_xp DESC
  const { data: teamsRaw } = await supabase
    .from("teams")
    .select("id, name, cumulative_xp, level")
    .eq("league_id", leagueId)
    .order("cumulative_xp", { ascending: false });

  const teams = teamsRaw ?? [];

  // Get owner display_name for each team via league_members
  const teamIds = teams.map((t) => t.id);
  const { data: membersRaw } = await supabase
    .from("league_members")
    .select("team_id, user_id, users(display_name)")
    .eq("league_id", leagueId)
    .in("team_id", teamIds.length > 0 ? teamIds : ["__none__"]);

  const ownerByTeamId: Record<string, string> = {};
  for (const m of membersRaw ?? []) {
    if (m.team_id) {
      const u = Array.isArray(m.users) ? m.users[0] : m.users;
      ownerByTeamId[m.team_id] = (u as { display_name?: string })?.display_name ?? "Unknown";
    }
  }

  // All active/notice contracts in league, join riders
  const { data: contractsRaw } = await supabase
    .from("contracts")
    .select("id, team_id, rider_id, status, riders:rider_id(id, full_name, nationality, photo_url, pcs_rank)")
    .in("team_id", teamIds.length > 0 ? teamIds : ["__none__"])
    .in("status", ["active", "notice"]);

  const contracts = contractsRaw ?? [];

  // Get all rider IDs in league
  const riderIds = [...new Set(contracts.map((c) => c.rider_id))];

  // Aggregate race_results per rider (game XP = sum of pcs_points)
  const { data: resultsRaw } = await supabase
    .from("race_results")
    .select("rider_id, race_slug, race_name, race_date, pcs_points")
    .in("rider_id", riderIds.length > 0 ? riderIds : ["__none__"])
    .order("race_date", { ascending: false });

  const results = resultsRaw ?? [];

  // Compute per-rider total XP
  const riderXpTotal: Record<string, number> = {};
  for (const r of results) {
    riderXpTotal[r.rider_id] = (riderXpTotal[r.rider_id] ?? 0) + (r.pcs_points ?? 0);
  }

  // Compute per-team total XP from race results (not cumulative_xp which is DB-stored)
  // We use cumulative_xp from teams table for main ranking
  // But we need per-race breakdowns for filtering

  // Build race list (distinct completed races)
  const raceMap = new Map<string, { slug: string; name: string; date: string }>();
  for (const r of results) {
    if (!raceMap.has(r.race_slug)) {
      raceMap.set(r.race_slug, { slug: r.race_slug, name: r.race_name, date: r.race_date ?? "" });
    }
  }
  const races = [...raceMap.values()].sort((a, b) => b.date.localeCompare(a.date));

  // Per-race XP maps for client-side re-ranking
  const teamXpByRace: Record<string, Record<string, number>> = {};
  const riderXpByRace: Record<string, Record<string, number>> = {};

  // Map rider_id → team_id for this league
  const riderToTeam: Record<string, string> = {};
  for (const c of contracts) {
    riderToTeam[c.rider_id] = c.team_id;
  }

  for (const r of results) {
    const raceSlug = r.race_slug;
    const teamId = riderToTeam[r.rider_id];
    const pts = r.pcs_points ?? 0;

    if (!riderXpByRace[raceSlug]) riderXpByRace[raceSlug] = {};
    riderXpByRace[raceSlug][r.rider_id] = (riderXpByRace[raceSlug][r.rider_id] ?? 0) + pts;

    if (teamId) {
      if (!teamXpByRace[raceSlug]) teamXpByRace[raceSlug] = {};
      teamXpByRace[raceSlug][teamId] = (teamXpByRace[raceSlug][teamId] ?? 0) + pts;
    }
  }

  // Movement: compare current rank vs rank-before-latest-race
  // Latest race = first entry in races array (sorted by date DESC)
  const latestRace = races.length > 0 ? races[0].slug : null;

  // Team movement
  const teamMovement: Record<string, number> = {};
  if (latestRace) {
    const latestRaceXp = teamXpByRace[latestRace] ?? {};
    // Previous XP = cumulative_xp minus latest race contribution
    const prevTeamXp = teams.map((t) => ({
      id: t.id,
      xp: t.cumulative_xp - (latestRaceXp[t.id] ?? 0),
    }));
    prevTeamXp.sort((a, b) => b.xp - a.xp);
    const prevRankMap: Record<string, number> = {};
    prevTeamXp.forEach((t, i) => { prevRankMap[t.id] = i + 1; });

    teams.forEach((t, i) => {
      const currentRank = i + 1; // teams already sorted by cumulative_xp DESC
      const prevRank = prevRankMap[t.id] ?? currentRank;
      teamMovement[t.id] = prevRank - currentRank; // positive = moved up
    });
  }

  // Rider movement
  const riderMovement: Record<string, number> = {};
  if (latestRace) {
    const latestRaceRiderXp = riderXpByRace[latestRace] ?? {};
    // Current rider ranking
    const currentRiderRanking = riderIds
      .map((id) => ({ id, xp: riderXpTotal[id] ?? 0 }))
      .sort((a, b) => b.xp - a.xp);
    const currentRiderRankMap: Record<string, number> = {};
    currentRiderRanking.forEach((r, i) => { currentRiderRankMap[r.id] = i + 1; });

    // Previous ranking (subtract latest race XP)
    const prevRiderRanking = riderIds
      .map((id) => ({ id, xp: (riderXpTotal[id] ?? 0) - (latestRaceRiderXp[id] ?? 0) }))
      .sort((a, b) => b.xp - a.xp);
    const prevRiderRankMap: Record<string, number> = {};
    prevRiderRanking.forEach((r, i) => { prevRiderRankMap[r.id] = i + 1; });

    for (const id of riderIds) {
      const currentRank = currentRiderRankMap[id] ?? 0;
      const prevRank = prevRiderRankMap[id] ?? currentRank;
      riderMovement[id] = prevRank - currentRank;
    }
  }

  // Build serializable data for client
  const teamsData = teams.map((t, i) => ({
    id: t.id,
    name: t.name,
    xp: t.cumulative_xp,
    level: t.level,
    rank: i + 1,
    movement: teamMovement[t.id] ?? 0,
    isMe: t.id === myTeamId,
    ownerName: ownerByTeamId[t.id] ?? "Unknown",
  }));

  // Build rider data with owner info
  const riderOwnerMap: Record<string, { teamId: string; teamName: string; ownerName: string }> = {};
  for (const c of contracts) {
    const team = teams.find((t) => t.id === c.team_id);
    riderOwnerMap[c.rider_id] = {
      teamId: c.team_id,
      teamName: team?.name ?? "",
      ownerName: ownerByTeamId[c.team_id] ?? "Unknown",
    };
  }

  const ridersData = contracts.map((c) => {
    const rider = Array.isArray(c.riders) ? c.riders[0] : c.riders;
    const r = rider as { id: string; full_name: string; nationality: string | null; photo_url: string | null; pcs_rank: number | null };
    const owner = riderOwnerMap[c.rider_id];
    return {
      id: r.id,
      fullName: r.full_name,
      nationality: r.nationality,
      photoUrl: r.photo_url,
      pcsRank: r.pcs_rank,
      xp: riderXpTotal[c.rider_id] ?? 0,
      movement: riderMovement[c.rider_id] ?? 0,
      ownerName: owner?.ownerName ?? null,
      teamId: owner?.teamId ?? null,
      isMyRider: c.team_id === myTeamId,
    };
  }).sort((a, b) => b.xp - a.xp);

  return (
    <RankingClient
      leagueId={leagueId}
      teams={teamsData}
      riders={ridersData}
      races={races}
      teamXpByRace={teamXpByRace}
      riderXpByRace={riderXpByRace}
    />
  );
}
