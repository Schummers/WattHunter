import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { redirect } from "next/navigation";
import { AchievementsClient } from "./achievements-client";
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";
import { completedGrandTourYears } from "@/lib/grand-tour-completion";
import { fetchAllSupabasePages } from "@/lib/supabase-pagination";
import { oneDayRaceSlugPatterns } from "@/lib/race-groups";

type TeamXpRow = {
  team_id: string;
  xp_gained: number | null;
};

// One-day WT races for Classic Man. Derived from the World Tour calendar, never
// hand-written: the hand-written list carried Paris-Nice and Tirreno-Adriatico,
// two stage races, so the achievement did not reward what it announced (issue 04).
const ONE_DAY_WT_PATTERNS = oneDayRaceSlugPatterns()

// Monument race bases — used to match slugs across all years
const MONUMENT_BASES = [
  { ilike: "race/paris-roubaix/%",           base: "paris-roubaix" },
  { ilike: "race/ronde-van-vlaanderen/%",    base: "flandres" },
  { ilike: "race/liege-bastogne-liege/%",    base: "lbl" },
  { ilike: "race/il-lombardia/%",            base: "lombardia" },
  { ilike: "race/milano-sanremo/%",          base: "milan-sanremo" },
]

function monumentBase(slug: string): string | null {
  for (const { ilike, base } of MONUMENT_BASES) {
    const pattern = new RegExp("^" + ilike.replace(/%/g, ".*") + "$")
    if (pattern.test(slug)) return base
  }
  return null
}

function yearFromSlug(slug: string): number | null {
  const m = slug.match(/\/(\d{4})\//)
  return m ? parseInt(m[1]) : null
}

export default async function AchievementsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoAchievements();

  const user = await getUser();
  if (!user) redirect("/login");

  // Captured once: the narrowing from the guard above does not survive into the
  // closures declared further down.
  const myUserId = user.id;

  const supabase = await createClient();

  // Team membership + equipped slug
  const { data: membership } = await supabase
    .from("league_members")
    .select("team_id, teams:team_id(equipped_achievement_slug)")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  const team = membership?.teams as { equipped_achievement_slug: string | null } | null;
  const equippedSlug = team?.equipped_achievement_slug ?? null;
  const myTeamId = membership?.team_id ?? null;

  const unlockedSlugs: string[] = [];

  // A palmarès belongs to the player, not to one team. The 2026 season alone is
  // two classic leagues (V1 carried the Classics and the Giro, V2 the Tour and
  // the Vuelta): reading a single team hides half of what was won, which is why
  // three teams used to receive their badges by hand, keyed on their UUID.
  const { data: seasonLeagues } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_year", new Date().getFullYear())
    .eq("is_demo", false)
    .neq("status", "pending");

  const seasonLeagueIds = (seasonLeagues ?? []).map((l) => l.id as string);
  const { data: myMemberships } = await supabase
    .from("league_members")
    .select("team_id")
    .eq("user_id", myUserId)
    .in("league_id", seasonLeagueIds.length > 0 ? seasonLeagueIds : ["__none__"]);

  const myTeamIds = [
    ...new Set(
      [myTeamId, ...(myMemberships ?? []).map((m) => m.team_id)].filter(
        (id): id is string => id !== null,
      ),
    ),
  ];

  if (!myTeamId) {
    return (
      <AchievementsClient
        leagueId={leagueId}
        equippedSlug={equippedSlug}
        unlockedSlugs={[]}
      />
    );
  }

  // ── Block 1 & 2: Monument Individual + Combined ──────────────────────────
  // Single query across ALL years (fix year-lock)
  const { data: monumentXpRows } = await supabase
    .from("rider_xp_daily")
    .select("race_slug, rider_id")
    .in("team_id", myTeamIds)
    .or(MONUMENT_BASES.map(({ ilike }) => `race_slug.ilike.${ilike}`).join(","))

  const teamRiderByRace = new Map<string, string[]>();
  for (const row of monumentXpRows ?? []) {
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

    // Group 1 — individual monuments
    for (const r of results ?? []) {
      const base = monumentBase(r.race_slug);
      if (!base || r.rank == null) continue;
      if (!teamRiderByRace.get(r.race_slug)?.includes(r.rider_id)) continue;
      if (r.rank <= 10) unlockedSlugs.push(`${base}-top10`);
      if (r.rank <= 3)  unlockedSlugs.push(`${base}-podium`);
      if (r.rank === 1) unlockedSlugs.push(`${base}-victory`);
    }

    // Group 2 — monuments-double: career wins at ≥2 distinct monuments
    const careerWins = new Set<string>();
    for (const r of results ?? []) {
      if (r.rank !== 1) continue;
      const base = monumentBase(r.race_slug);
      if (base) careerWins.add(base);
    }
    if (careerWins.size >= 2) unlockedSlugs.push("monuments-double");

    // Group 2 — monuments-collector / monuments-hunter: same season
    // Group by year → { year → { base → best rank } }
    const byYear = new Map<number, Map<string, number>>();
    for (const r of results ?? []) {
      const base = monumentBase(r.race_slug);
      const year = yearFromSlug(r.race_slug);
      if (!base || !year || r.rank == null) continue;
      const rank = r.rank;
      const yearMap = byYear.get(year) ?? new Map<string, number>();
      const existing = yearMap.get(base);
      if (existing === undefined || rank < existing) yearMap.set(base, rank);
      byYear.set(year, yearMap);
    }
    for (const [, yearMap] of byYear) {
      const top10Count = Array.from(yearMap.values()).filter((rank) => rank <= 10).length;
      const top5Count  = Array.from(yearMap.values()).filter((rank) => rank <= 5).length;
      if (top10Count >= 5) unlockedSlugs.push("monuments-collector");
      if (top5Count  >= 3) unlockedSlugs.push("monuments-hunter");
    }
  }

  // ── Block 3: Giro GC ────────────────────────────────────────────────────
  // Find riders who scored XP for this team on any Giro stage (ownership proof)
  const { data: giroXpRows } = await supabase
    .from("rider_xp_daily")
    .select("race_slug, rider_id")
    .in("team_id", myTeamIds)
    .ilike("race_slug", "race/giro-d-italia/%/stage-%")

  const giroRiderIds = [...new Set((giroXpRows ?? []).map((r) => r.rider_id))];

  if (giroRiderIds.length > 0) {
    // ── Giro completion gate (shared by Blocks 3 & 4) ─────────────────────
    // A jersey is only "won" once the race is finished AND fully synced.
    // Without this gate the *current* jersey holder on the latest synced stage
    // is wrongly awarded. Both signals are computed globally (across every
    // rider), not scoped to this team. See lib/grand-tour-completion.ts.
    const { data: allGiroStages } = await supabase
      .from("gt_daily_classifications")
      .select("race_slug, stage")
      .ilike("race_slug", "race/giro-d-italia/%/stage-%");

    const { data: scoredGiroGc } = await supabase
      .from("race_results")
      .select("race_slug")
      .ilike("race_slug", "race/giro-d-italia/%/gc")
      .gt("pcs_points", 0);

    // Spec C moved the final jerseys into `gt_final_classifications`. Their
    // presence is the other half of signal A — and the only half that holds for
    // the Giro 2026, whose daily classifications stop at stage 20.
    const { data: giroFinals } = await supabase
      .from("gt_final_classifications")
      .select("race_slug")
      .ilike("race_slug", "race/giro-d-italia/%");

    const completedYears = completedGrandTourYears(
      "giro-d-italia",
      allGiroStages ?? [],
      scoredGiroGc ?? [],
      giroFinals ?? [],
    );

    // ── Block 3: Giro GC (final classification, completed years only) ─────
    const { data: giroGcResults } = await supabase
      .from("race_results")
      .select("rider_id, rank, race_slug")
      .ilike("race_slug", "race/giro-d-italia/%/gc")
      .in("rider_id", giroRiderIds)
      .lte("rank", 3);

    for (const r of giroGcResults ?? []) {
      if (r.rank == null) continue;
      const yearMatch = r.race_slug.match(/giro-d-italia\/(\d{4})\//);
      if (!yearMatch || !completedYears.has(yearMatch[1])) continue;
      if (r.rank === 1) unlockedSlugs.push("giro-gc-victory");
      if (r.rank <= 3)  unlockedSlugs.push("giro-gc-podium");
    }

    // ── Block 4: Giro KOM + Points (final classification, completed years) ──
    // Read from `gt_final_classifications`, not from the last stage's daily
    // classification: Spec C moved the finals there, so the old query hit an
    // empty table and no Giro jersey could ever unlock.
    for (const year of completedYears) {
      const { data: jerseyRows } = await supabase
        .from("gt_final_classifications")
        .select("rider_id, classification_type, rank, race_slug")
        .ilike("race_slug", `race/giro-d-italia/${year}/%`)
        .in("rider_id", giroRiderIds)
        .eq("rank", 1)
        .in("classification_type", ["kom", "points"]);

      for (const j of jerseyRows ?? []) {
        if (j.classification_type === "kom")    unlockedSlugs.push("giro-kom-victory");
        if (j.classification_type === "points") unlockedSlugs.push("giro-points-victory");
      }
    }
  }

  // ── Block 5: Dynamic leaderboards (Monument Man / Classic Man) ────────────
  const dynamicRanks: Record<string, number> = {};

  // Every team of the season, with the player who owns it: the leaderboards rank
  // players, not teams. Someone holding a team in each league of the season would
  // otherwise compete against himself, his XP split across two rows.
  const { data: seasonMembers } = await supabase
    .from("league_members")
    .select("team_id, user_id")
    .in("league_id", seasonLeagueIds.length > 0 ? seasonLeagueIds : ["__none__"]);

  const userByTeam = new Map<string, string>();
  for (const member of seasonMembers ?? []) {
    if (member.team_id) userByTeam.set(member.team_id, member.user_id);
  }
  const leagueTeamIds = [...userByTeam.keys()];

  function rankPlayers(rows: TeamXpRow[]): number {
    const xpByUser = new Map<string, number>();
    for (const row of rows) {
      const owner = userByTeam.get(row.team_id);
      if (!owner) continue;
      xpByUser.set(owner, (xpByUser.get(owner) ?? 0) + (row.xp_gained ?? 0));
    }
    const ranking = [...xpByUser.entries()].sort((a, b) => b[1] - a[1]);
    return ranking.findIndex(([uid]) => uid === myUserId) + 1;
  }

  if (leagueTeamIds.length > 0) {
    // Monument Man: cumulative XP on monument races per team
    const monumentXpAll = await fetchAllSupabasePages<TeamXpRow>((rangeFrom, rangeTo) =>
      supabase
        .from("rider_xp_daily")
        .select("team_id, xp_gained")
        .in("team_id", leagueTeamIds)
        .or(MONUMENT_BASES.map(({ ilike }) => `race_slug.ilike.${ilike}`).join(","))
        .order("id")
        .range(rangeFrom, rangeTo),
    );

    const monumentRank = rankPlayers(monumentXpAll);
    if (monumentRank > 0) dynamicRanks["monument-man"] = monumentRank;
    if (monumentRank === 1) unlockedSlugs.push("monument-man");

    // Classic Man: cumulative XP on all one-day WT races per team
    const classicXpAll = await fetchAllSupabasePages<TeamXpRow>((rangeFrom, rangeTo) =>
      supabase
        .from("rider_xp_daily")
        .select("team_id, xp_gained")
        .in("team_id", leagueTeamIds)
        .or(ONE_DAY_WT_PATTERNS.map((p) => `race_slug.ilike.${p}`).join(","))
        .order("id")
        .range(rangeFrom, rangeTo),
    );

    const classicRank = rankPlayers(classicXpAll);
    if (classicRank > 0) dynamicRanks["classic-man"] = classicRank;
    if (classicRank === 1) unlockedSlugs.push("classic-man");
  }

  return (
    <AchievementsClient
      leagueId={leagueId}
      equippedSlug={equippedSlug}
      unlockedSlugs={[...new Set(unlockedSlugs)]}
      dynamicRanks={dynamicRanks}
    />
  );
}

// ---------------------------------------------------------------------------
// Demo path — anonymous visitor, no auth required
// ---------------------------------------------------------------------------
async function renderDemoAchievements() {
  const supabase = await createClient();
  const myTeamId = DEMO_VISITOR_TEAM_ID;
  const leagueId = DEMO_LEAGUE_ID;

  // Team equipped slug
  const { data: teamRow } = await supabase
    .from("teams")
    .select("equipped_achievement_slug")
    .eq("id", myTeamId)
    .single();
  const equippedSlug = (teamRow as { equipped_achievement_slug?: string | null } | null)?.equipped_achievement_slug ?? null;

  const unlockedSlugs: string[] = [];

  // Block 1 & 2: Monument achievements
  const { data: monumentXpRows } = await supabase
    .from("rider_xp_daily")
    .select("race_slug, rider_id")
    .eq("team_id", myTeamId)
    .or(MONUMENT_BASES.map(({ ilike }) => `race_slug.ilike.${ilike}`).join(","));

  const teamRiderByRace = new Map<string, string[]>();
  for (const row of monumentXpRows ?? []) {
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
      const base = monumentBase(r.race_slug);
      if (!base || r.rank == null) continue;
      if (!teamRiderByRace.get(r.race_slug)?.includes(r.rider_id)) continue;
      if (r.rank <= 10) unlockedSlugs.push(`${base}-top10`);
      if (r.rank <= 3)  unlockedSlugs.push(`${base}-podium`);
      if (r.rank === 1) unlockedSlugs.push(`${base}-victory`);
    }

    const careerWins = new Set<string>();
    for (const r of results ?? []) {
      if (r.rank !== 1) continue;
      const base = monumentBase(r.race_slug);
      if (base) careerWins.add(base);
    }
    if (careerWins.size >= 2) unlockedSlugs.push("monuments-double");

    const byYear = new Map<number, Map<string, number>>();
    for (const r of results ?? []) {
      const base = monumentBase(r.race_slug);
      const year = yearFromSlug(r.race_slug);
      if (!base || !year || r.rank == null) continue;
      const rank = r.rank;
      const yearMap = byYear.get(year) ?? new Map<string, number>();
      const existing = yearMap.get(base);
      if (existing === undefined || rank < existing) yearMap.set(base, rank);
      byYear.set(year, yearMap);
    }
    for (const [, yearMap] of byYear) {
      const top10Count = Array.from(yearMap.values()).filter((rank) => rank <= 10).length;
      const top5Count  = Array.from(yearMap.values()).filter((rank) => rank <= 5).length;
      if (top10Count >= 5) unlockedSlugs.push("monuments-collector");
      if (top5Count  >= 3) unlockedSlugs.push("monuments-hunter");
    }
  }

  // Block 3: Giro GC
  const { data: giroXpRows } = await supabase
    .from("rider_xp_daily")
    .select("race_slug, rider_id")
    .eq("team_id", myTeamId)
    .ilike("race_slug", "race/giro-d-italia/%/stage-%");

  const giroRiderIds = [...new Set((giroXpRows ?? []).map((r) => r.rider_id))];

  if (giroRiderIds.length > 0) {
    const { data: giroGcResults } = await supabase
      .from("race_results")
      .select("rider_id, rank")
      .ilike("race_slug", "race/giro-d-italia/%/gc")
      .in("rider_id", giroRiderIds)
      .lte("rank", 3);

    for (const r of giroGcResults ?? []) {
      if (r.rank == null) continue;
      if (r.rank === 1) unlockedSlugs.push("giro-gc-victory");
      if (r.rank <= 3)  unlockedSlugs.push("giro-gc-podium");
    }

    // Block 4: KOM + Points (gt_daily_classifications empty in demo → no slugs added)
    const { data: giroStages } = await supabase
      .from("gt_daily_classifications")
      .select("race_slug, stage")
      .ilike("race_slug", "race/giro-d-italia/%/stage-%")
      .in("rider_id", giroRiderIds);

    const maxStageByYear = new Map<string, number>();
    for (const row of giroStages ?? []) {
      const m = row.stage?.match(/stage-(\d+)/);
      if (!m) continue;
      const n = parseInt(m[1]);
      const yearMatch = row.race_slug.match(/giro-d-italia\/(\d{4})\//);
      if (!yearMatch) continue;
      const key = yearMatch[1];
      if ((maxStageByYear.get(key) ?? 0) < n) maxStageByYear.set(key, n);
    }

    for (const [year, maxStage] of maxStageByYear) {
      const lastSlug = `race/giro-d-italia/${year}/stage-${maxStage}`;
      const { data: jerseyRows } = await supabase
        .from("gt_daily_classifications")
        .select("rider_id, classification_type, rank")
        .eq("race_slug", lastSlug)
        .in("rider_id", giroRiderIds)
        .eq("rank", 1)
        .in("classification_type", ["kom", "points"]);

      for (const j of jerseyRows ?? []) {
        if (j.classification_type === "kom")    unlockedSlugs.push("giro-kom-victory");
        if (j.classification_type === "points") unlockedSlugs.push("giro-points-victory");
      }
    }
  }

  // Block 5: Dynamic leaderboards
  const dynamicRanks: Record<string, number> = {};

  const { data: leagueMembers } = await supabase
    .from("league_members")
    .select("team_id")
    .eq("league_id", leagueId);

  const leagueTeamIds = (leagueMembers ?? []).map((m) => m.team_id).filter((id): id is string => id !== null);

  if (leagueTeamIds.length > 0) {
    const monumentXpAll = await fetchAllSupabasePages<TeamXpRow>((rangeFrom, rangeTo) =>
      supabase
        .from("rider_xp_daily")
        .select("team_id, xp_gained")
        .in("team_id", leagueTeamIds)
        .or(MONUMENT_BASES.map(({ ilike }) => `race_slug.ilike.${ilike}`).join(","))
        .order("id")
        .range(rangeFrom, rangeTo),
    );

    const monumentXpByTeam = new Map<string, number>();
    for (const row of monumentXpAll) {
      monumentXpByTeam.set(row.team_id, (monumentXpByTeam.get(row.team_id) ?? 0) + (row.xp_gained ?? 0));
    }
    const monumentRanking = [...monumentXpByTeam.entries()].sort((a, b) => b[1] - a[1]);
    const monumentRank = monumentRanking.findIndex(([tid]) => tid === myTeamId) + 1;
    if (monumentRank > 0) dynamicRanks["monument-man"] = monumentRank;
    if (monumentRank === 1) unlockedSlugs.push("monument-man");

    const classicXpAll = await fetchAllSupabasePages<TeamXpRow>((rangeFrom, rangeTo) =>
      supabase
        .from("rider_xp_daily")
        .select("team_id, xp_gained")
        .in("team_id", leagueTeamIds)
        .or(ONE_DAY_WT_PATTERNS.map((p) => `race_slug.ilike.${p}`).join(","))
        .order("id")
        .range(rangeFrom, rangeTo),
    );

    const classicXpByTeam = new Map<string, number>();
    for (const row of classicXpAll) {
      classicXpByTeam.set(row.team_id, (classicXpByTeam.get(row.team_id) ?? 0) + (row.xp_gained ?? 0));
    }
    const classicRanking = [...classicXpByTeam.entries()].sort((a, b) => b[1] - a[1]);
    const classicRank = classicRanking.findIndex(([tid]) => tid === myTeamId) + 1;
    if (classicRank > 0) dynamicRanks["classic-man"] = classicRank;
    if (classicRank === 1) unlockedSlugs.push("classic-man");
  }

  return (
    <AchievementsClient
      leagueId={DEMO_LEAGUE_SLUG}
      equippedSlug={equippedSlug}
      unlockedSlugs={[...new Set(unlockedSlugs)]}
      dynamicRanks={dynamicRanks}
    />
  );
}
