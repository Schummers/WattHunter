import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { getAchievementBySlug } from "@/lib/achievements";
import { RankingClient } from "./ranking-client";
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

export default async function RankingPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ race?: string }>;
}) {
  const { leagueId } = await params;
  const { race: initialRace } = await searchParams;

  if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoRanking(initialRace);

  const supabase = await createClient();

  const user = await getUser();

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
    .select("id, name, cumulative_xp, level, treasury, equipped_achievement_slug")
    .eq("league_id", leagueId)
    .order("cumulative_xp", { ascending: false });

  const teams = teamsRaw ?? [];

  // Get owner display_name for each team via league_members
  const teamIds = teams.map((t) => t.id);

  // Parallelize: members, contracts, xpData all depend only on teamIds
  const [{ data: membersRaw }, { data: contractsRaw }, { data: xpDataRaw }] =
    await Promise.all([
      supabase
        .from("league_members")
        .select("team_id, user_id, users(display_name)")
        .eq("league_id", leagueId)
        .in("team_id", teamIds.length > 0 ? teamIds : ["__none__"]),
      supabase
        .from("contracts")
        .select("id, team_id, rider_id, status, released_at, riders:rider_id(id, full_name, nationality, photo_url, pcs_rank)")
        .in("team_id", teamIds.length > 0 ? teamIds : ["__none__"])
        .in("status", ["active", "released"]),
      supabase
        .from("rider_xp_daily")
        .select("rider_id, team_id, race_slug, xp_gained, date")
        .in("team_id", teamIds.length > 0 ? teamIds : ["__none__"]),
    ]);

  const ownerByTeamId: Record<string, string> = {};
  for (const m of membersRaw ?? []) {
    if (m.team_id) {
      const u = Array.isArray(m.users) ? m.users[0] : m.users;
      ownerByTeamId[m.team_id] = (u as { display_name?: string })?.display_name ?? "Unknown";
    }
  }

  // All active/notice contracts in league, join riders
  const contracts = contractsRaw ?? [];

  // Deduplicate by rider_id: active beats released; latest released_at wins among released
  const contractByRider = new Map<string, typeof contracts[number]>();
  for (const c of contracts) {
    const existing = contractByRider.get(c.rider_id);
    if (!existing) {
      contractByRider.set(c.rider_id, c);
    } else if (c.status === "active" && existing.status !== "active") {
      contractByRider.set(c.rider_id, c);
    } else if (c.status === "released" && existing.status === "released") {
      const cTime = (c as { released_at?: string | null }).released_at ?? "";
      const eTime = (existing as { released_at?: string | null }).released_at ?? "";
      if (cTime > eTime) contractByRider.set(c.rider_id, c);
    }
  }
  const dedupedContracts = [...contractByRider.values()];

  // Get all rider IDs in league
  const riderIds = dedupedContracts.map((c) => c.rider_id);

  const xpData = xpDataRaw ?? [];

  // Compute per-rider total XP (game XP, not raw PCS)
  const riderXpTotal: Record<string, number> = {};
  for (const r of xpData) {
    riderXpTotal[r.rider_id] = (riderXpTotal[r.rider_id] ?? 0) + (r.xp_gained ?? 0);
  }

  // Build race list from rider_xp_daily race_slugs
  // We also need race names/dates — fetch from race_results for metadata
  const allRaceSlugs = [...new Set(xpData.map((x) => x.race_slug).filter(Boolean))];
  const { data: raceMetaRaw } = await supabase
    .from("race_results")
    .select("race_slug, race_name, race_date")
    .in("race_slug", allRaceSlugs.length > 0 ? allRaceSlugs : ["__none__"]);

  const raceMeta: Record<string, { name: string; date: string }> = {};
  for (const r of raceMetaRaw ?? []) {
    if (!raceMeta[r.race_slug]) {
      raceMeta[r.race_slug] = { name: r.race_name, date: r.race_date ?? "" };
    }
  }

  // Build race list — group staged races into single entries
  const parentRaceMap = new Map<string, { slug: string; name: string; date: string; childSlugs: string[] }>();
  for (const slug of allRaceSlugs) {
    const meta = raceMeta[slug] || { name: slug, date: "" };
    const stageMatch = slug.match(/^(.+)\/stage-\d+$/);
    const parentSlug = stageMatch ? stageMatch[1] : slug;
    const parentName = stageMatch ? meta.name.replace(/\s*\|?\s*Stage\s+\d+.*$/i, "") || meta.name : meta.name;

    const existing = parentRaceMap.get(parentSlug);
    if (existing) {
      if (!existing.childSlugs.includes(slug)) {
        existing.childSlugs.push(slug);
      }
      if ((meta.date ?? "") > existing.date) {
        existing.date = meta.date ?? "";
      }
    } else {
      parentRaceMap.set(parentSlug, {
        slug: parentSlug,
        name: parentName,
        date: meta.date ?? "",
        childSlugs: [slug],
      });
    }
  }
  const races = [...parentRaceMap.values()].sort((a, b) => b.date.localeCompare(a.date));

  // Per-race XP maps for client-side re-ranking (using game XP)
  const teamXpByRace: Record<string, Record<string, number>> = {};
  const riderXpByRace: Record<string, Record<string, number>> = {};

  for (const r of xpData) {
    const raceSlug = r.race_slug;
    if (!raceSlug) continue;
    const teamId = r.team_id;
    const pts = r.xp_gained ?? 0;

    if (!riderXpByRace[raceSlug]) riderXpByRace[raceSlug] = {};
    riderXpByRace[raceSlug][r.rider_id] = (riderXpByRace[raceSlug][r.rider_id] ?? 0) + pts;

    if (teamId) {
      if (!teamXpByRace[raceSlug]) teamXpByRace[raceSlug] = {};
      teamXpByRace[raceSlug][teamId] = (teamXpByRace[raceSlug][teamId] ?? 0) + pts;
    }
  }

  // Task 7: Movement via team_ranking_daily snapshot
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // Parallelize: today and yesterday snapshots are independent
  const [{ data: todayRanks }, { data: yesterdayRanks }] = await Promise.all([
    supabase
      .from("team_ranking_daily")
      .select("team_id, rank")
      .eq("date", today)
      .in("team_id", teamIds.length > 0 ? teamIds : ["__none__"]),
    supabase
      .from("team_ranking_daily")
      .select("team_id, rank")
      .eq("date", yesterday)
      .in("team_id", teamIds.length > 0 ? teamIds : ["__none__"]),
  ]);

  const todayRankMap: Record<string, number> = {};
  for (const r of todayRanks ?? []) {
    todayRankMap[r.team_id] = r.rank;
  }
  const yesterdayRankMap: Record<string, number> = {};
  for (const r of yesterdayRanks ?? []) {
    yesterdayRankMap[r.team_id] = r.rank;
  }

  const teamMovement: Record<string, number> = {};
  for (const t of teams) {
    const yRank = yesterdayRankMap[t.id];
    const tRank = todayRankMap[t.id];
    if (yRank !== undefined && tRank !== undefined) {
      teamMovement[t.id] = yRank - tRank; // positive = moved up
    }
  }

  // Rider movement: compare current vs previous day XP rankings
  const riderMovement: Record<string, number> = {};
  // Group xpData by date to find today/yesterday rider XP
  const riderXpByDate: Record<string, Record<string, number>> = {};
  for (const r of xpData) {
    const d = r.date;
    if (!d) continue;
    if (!riderXpByDate[d]) riderXpByDate[d] = {};
    riderXpByDate[d][r.rider_id] = (riderXpByDate[d][r.rider_id] ?? 0) + (r.xp_gained ?? 0);
  }

  // If there's today's data, compute movement by comparing total XP with/without today
  const todayRiderXp = riderXpByDate[today] ?? {};
  if (Object.keys(todayRiderXp).length > 0) {
    const currentRanking = riderIds
      .map((id) => ({ id, xp: riderXpTotal[id] ?? 0 }))
      .sort((a, b) => b.xp - a.xp);
    const currentRankMap: Record<string, number> = {};
    currentRanking.forEach((r, i) => { currentRankMap[r.id] = i + 1; });

    const prevRanking = riderIds
      .map((id) => ({ id, xp: (riderXpTotal[id] ?? 0) - (todayRiderXp[id] ?? 0) }))
      .sort((a, b) => b.xp - a.xp);
    const prevRankMap: Record<string, number> = {};
    prevRanking.forEach((r, i) => { prevRankMap[r.id] = i + 1; });

    for (const id of riderIds) {
      const cRank = currentRankMap[id] ?? 0;
      const pRank = prevRankMap[id] ?? cRank;
      riderMovement[id] = pRank - cRank;
    }
  }

  // Build serializable data for client
  const teamsData = teams.map((t, i) => {
    const equippedSlug = (t as { equipped_achievement_slug?: string | null }).equipped_achievement_slug ?? null;
    const achievement = equippedSlug ? getAchievementBySlug(equippedSlug) : undefined;
    return {
      id: t.id,
      name: t.name,
      xp: t.cumulative_xp,
      level: t.level,
      treasury: t.treasury,
      rank: i + 1,
      movement: teamMovement[t.id] ?? 0,
      isMe: t.id === myTeamId,
      ownerName: ownerByTeamId[t.id] ?? "Unknown",
      equippedBadgeUrl: achievement?.badgeUrl ?? null,
      equippedBannerUrl: achievement?.bannerUrl ?? null,
      equippedAchievementName: achievement?.name ?? null,
      equippedAchievementTier: achievement?.tier ?? null,
    };
  });

  // Build rider data with owner info
  const riderOwnerMap: Record<string, { teamId: string; teamName: string; ownerName: string } | null> = {};
  for (const c of dedupedContracts) {
    if (c.status === "active") {
      const team = teams.find((t) => t.id === c.team_id);
      riderOwnerMap[c.rider_id] = {
        teamId: c.team_id,
        teamName: team?.name ?? "",
        ownerName: ownerByTeamId[c.team_id] ?? "Unknown",
      };
    } else {
      riderOwnerMap[c.rider_id] = null; // free agent
    }
  }

  const ridersData = dedupedContracts.map((c) => {
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
      isMyRider: c.status === "active" && c.team_id === myTeamId,
      isFormer: c.status === "released",
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
      initialRace={initialRace ?? null}
    />
  );
}

// ---------------------------------------------------------------------------
// Demo path — anonymous visitor, no auth required
// ---------------------------------------------------------------------------
async function renderDemoRanking(initialRace?: string) {
  const supabase = await createClient();
  const myTeamId = DEMO_VISITOR_TEAM_ID;

  const { data: teamsRaw } = await supabase
    .from("teams")
    .select("id, name, cumulative_xp, level, treasury, equipped_achievement_slug")
    .eq("league_id", DEMO_LEAGUE_ID)
    .order("cumulative_xp", { ascending: false });

  const teams = teamsRaw ?? [];
  const teamIds = teams.map((t) => t.id);

  const [{ data: membersRaw }, { data: contractsRaw }, { data: xpDataRaw }] =
    await Promise.all([
      supabase
        .from("league_members")
        .select("team_id, user_id, users(display_name)")
        .eq("league_id", DEMO_LEAGUE_ID)
        .in("team_id", teamIds.length > 0 ? teamIds : ["__none__"]),
      supabase
        .from("contracts")
        .select("id, team_id, rider_id, status, released_at, riders:rider_id(id, full_name, nationality, photo_url, pcs_rank)")
        .in("team_id", teamIds.length > 0 ? teamIds : ["__none__"])
        .in("status", ["active", "released"]),
      supabase
        .from("rider_xp_daily")
        .select("rider_id, team_id, race_slug, xp_gained, date")
        .in("team_id", teamIds.length > 0 ? teamIds : ["__none__"]),
    ]);

  const ownerByTeamId: Record<string, string> = {};
  for (const m of membersRaw ?? []) {
    if (m.team_id) {
      const u = Array.isArray(m.users) ? m.users[0] : m.users;
      ownerByTeamId[m.team_id] = (u as { display_name?: string })?.display_name ?? "Unknown";
    }
  }

  const contracts = contractsRaw ?? [];
  const contractByRider = new Map<string, typeof contracts[number]>();
  for (const c of contracts) {
    const existing = contractByRider.get(c.rider_id);
    if (!existing) {
      contractByRider.set(c.rider_id, c);
    } else if (c.status === "active" && existing.status !== "active") {
      contractByRider.set(c.rider_id, c);
    } else if (c.status === "released" && existing.status === "released") {
      const cTime = (c as { released_at?: string | null }).released_at ?? "";
      const eTime = (existing as { released_at?: string | null }).released_at ?? "";
      if (cTime > eTime) contractByRider.set(c.rider_id, c);
    }
  }
  const dedupedContracts = [...contractByRider.values()];
  const riderIds = dedupedContracts.map((c) => c.rider_id);
  const xpData = xpDataRaw ?? [];

  const riderXpTotal: Record<string, number> = {};
  for (const r of xpData) {
    riderXpTotal[r.rider_id] = (riderXpTotal[r.rider_id] ?? 0) + (r.xp_gained ?? 0);
  }

  const allRaceSlugs = [...new Set(xpData.map((x) => x.race_slug).filter(Boolean))];
  const { data: raceMetaRaw } = await supabase
    .from("race_results")
    .select("race_slug, race_name, race_date")
    .in("race_slug", allRaceSlugs.length > 0 ? allRaceSlugs : ["__none__"]);

  const raceMeta: Record<string, { name: string; date: string }> = {};
  for (const r of raceMetaRaw ?? []) {
    if (!raceMeta[r.race_slug]) {
      raceMeta[r.race_slug] = { name: r.race_name, date: r.race_date ?? "" };
    }
  }

  const parentRaceMap = new Map<string, { slug: string; name: string; date: string; childSlugs: string[] }>();
  for (const slug of allRaceSlugs) {
    const meta = raceMeta[slug] || { name: slug, date: "" };
    const stageMatch = slug.match(/^(.+)\/stage-\d+$/);
    const parentSlug = stageMatch ? stageMatch[1] : slug;
    const parentName = stageMatch ? meta.name.replace(/\s*\|?\s*Stage\s+\d+.*$/i, "") || meta.name : meta.name;
    const existing = parentRaceMap.get(parentSlug);
    if (existing) {
      if (!existing.childSlugs.includes(slug)) existing.childSlugs.push(slug);
      if ((meta.date ?? "") > existing.date) existing.date = meta.date ?? "";
    } else {
      parentRaceMap.set(parentSlug, { slug: parentSlug, name: parentName, date: meta.date ?? "", childSlugs: [slug] });
    }
  }
  const races = [...parentRaceMap.values()].sort((a, b) => b.date.localeCompare(a.date));

  const teamXpByRace: Record<string, Record<string, number>> = {};
  const riderXpByRace: Record<string, Record<string, number>> = {};
  for (const r of xpData) {
    const raceSlug = r.race_slug;
    if (!raceSlug) continue;
    const teamId = r.team_id;
    const pts = r.xp_gained ?? 0;
    if (!riderXpByRace[raceSlug]) riderXpByRace[raceSlug] = {};
    riderXpByRace[raceSlug][r.rider_id] = (riderXpByRace[raceSlug][r.rider_id] ?? 0) + pts;
    if (teamId) {
      if (!teamXpByRace[raceSlug]) teamXpByRace[raceSlug] = {};
      teamXpByRace[raceSlug][teamId] = (teamXpByRace[raceSlug][teamId] ?? 0) + pts;
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const [{ data: todayRanks }, { data: yesterdayRanks }] = await Promise.all([
    supabase
      .from("team_ranking_daily")
      .select("team_id, rank")
      .eq("date", today)
      .in("team_id", teamIds.length > 0 ? teamIds : ["__none__"]),
    supabase
      .from("team_ranking_daily")
      .select("team_id, rank")
      .eq("date", yesterday)
      .in("team_id", teamIds.length > 0 ? teamIds : ["__none__"]),
  ]);

  const todayRankMap: Record<string, number> = {};
  for (const r of todayRanks ?? []) todayRankMap[r.team_id] = r.rank;
  const yesterdayRankMap: Record<string, number> = {};
  for (const r of yesterdayRanks ?? []) yesterdayRankMap[r.team_id] = r.rank;

  const teamMovement: Record<string, number> = {};
  for (const t of teams) {
    const yRank = yesterdayRankMap[t.id];
    const tRank = todayRankMap[t.id];
    if (yRank !== undefined && tRank !== undefined) teamMovement[t.id] = yRank - tRank;
  }

  const riderMovement: Record<string, number> = {};
  const riderXpByDate: Record<string, Record<string, number>> = {};
  for (const r of xpData) {
    const d = r.date;
    if (!d) continue;
    if (!riderXpByDate[d]) riderXpByDate[d] = {};
    riderXpByDate[d][r.rider_id] = (riderXpByDate[d][r.rider_id] ?? 0) + (r.xp_gained ?? 0);
  }
  const todayRiderXp = riderXpByDate[today] ?? {};
  if (Object.keys(todayRiderXp).length > 0) {
    const currentRanking = riderIds
      .map((id) => ({ id, xp: riderXpTotal[id] ?? 0 }))
      .sort((a, b) => b.xp - a.xp);
    const currentRankMap: Record<string, number> = {};
    currentRanking.forEach((r, i) => { currentRankMap[r.id] = i + 1; });
    const prevRanking = riderIds
      .map((id) => ({ id, xp: (riderXpTotal[id] ?? 0) - (todayRiderXp[id] ?? 0) }))
      .sort((a, b) => b.xp - a.xp);
    const prevRankMap: Record<string, number> = {};
    prevRanking.forEach((r, i) => { prevRankMap[r.id] = i + 1; });
    for (const id of riderIds) {
      const cRank = currentRankMap[id] ?? 0;
      const pRank = prevRankMap[id] ?? cRank;
      riderMovement[id] = pRank - cRank;
    }
  }

  const teamsData = teams.map((t, i) => {
    const equippedSlug = (t as { equipped_achievement_slug?: string | null }).equipped_achievement_slug ?? null;
    const achievement = equippedSlug ? getAchievementBySlug(equippedSlug) : undefined;
    return {
      id: t.id,
      name: t.name,
      xp: t.cumulative_xp,
      level: t.level,
      treasury: t.treasury,
      rank: i + 1,
      movement: teamMovement[t.id] ?? 0,
      isMe: t.id === myTeamId,
      ownerName: ownerByTeamId[t.id] ?? "Unknown",
      equippedBadgeUrl: achievement?.badgeUrl ?? null,
      equippedBannerUrl: achievement?.bannerUrl ?? null,
      equippedAchievementName: achievement?.name ?? null,
      equippedAchievementTier: achievement?.tier ?? null,
    };
  });

  const riderOwnerMap: Record<string, { teamId: string; teamName: string; ownerName: string } | null> = {};
  for (const c of dedupedContracts) {
    if (c.status === "active") {
      const team = teams.find((t) => t.id === c.team_id);
      riderOwnerMap[c.rider_id] = {
        teamId: c.team_id,
        teamName: team?.name ?? "",
        ownerName: ownerByTeamId[c.team_id] ?? "Unknown",
      };
    } else {
      riderOwnerMap[c.rider_id] = null;
    }
  }

  const ridersData = dedupedContracts.map((c) => {
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
      isMyRider: c.status === "active" && c.team_id === myTeamId,
      isFormer: c.status === "released",
    };
  }).sort((a, b) => b.xp - a.xp);

  return (
    <RankingClient
      leagueId={DEMO_LEAGUE_SLUG}
      teams={teamsData}
      riders={ridersData}
      races={races}
      teamXpByRace={teamXpByRace}
      riderXpByRace={riderXpByRace}
      initialRace={initialRace ?? null}
    />
  );
}
