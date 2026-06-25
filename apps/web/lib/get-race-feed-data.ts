import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentPhase, getPhaseRange, AUCTION_PHASES } from "./phases";
import { isGTPhaseId } from "./gt-phases";
import { GT_SCHEDULES, GT_REST_DAYS } from "./gt-stage-schedule";
import { WT_PARENT_SLUGS } from "./wt-race-slugs";
import {
  detectRaceType,
  getParentRaceSlug,
  getParentRaceLabel,
  formatRaceTitle,
  shortenRiderName,
  teamInitials,
} from "./race-feed-helpers";
import { getAchievementBySlug } from "./achievements";
import type {
  NemesisData,
  RaceCardStatus,
  RaceData,
  RaceDataWithBreakdown,
  RaceFeedCard,
  RaceFeedDateGroup,
  RaceFeedPayload,
  RiderRaceResult,
  TeamRaceResult,
} from "./race-feed-types";

type GetRaceFeedOpts = {
  leagueId: string;
  myTeamId: string;
  referenceDate?: Date;
};

export async function getRaceFeedData(
  supabase: SupabaseClient,
  opts: GetRaceFeedOpts
): Promise<RaceFeedPayload> {
  const referenceDate = opts.referenceDate ?? new Date();
  const todayIso = referenceDate.toISOString().slice(0, 10);

  const phase = getCurrentPhase(referenceDate);
  const isGtPhase = isGTPhaseId(phase.id);
  const range = getPhaseRange(phase, referenceDate.getFullYear());
  const phaseStartIso = range.start.toISOString().slice(0, 10);
  const phaseEndIso = range.end.toISOString().slice(0, 10);

  const cutoffPassed = isCutoffPassedCET();

  // 1) Fetch past+today races via race_results, future races via race_startlists
  const { data: pastRows = [] } = await supabase
    .from("race_results")
    .select("race_slug, race_name, race_date")
    .gte("race_date", phaseStartIso)
    .lte("race_date", phaseEndIso);

  const scoredSlugs = new Set((pastRows ?? []).map((r) => r.race_slug));

  const { data: futureRows = [] } = await supabase
    .from("race_startlists")
    .select("race_slug, race_name, race_date")
    .gte("race_date", todayIso)
    .lte("race_date", phaseEndIso);

  // Deduplicate races by slug (race_results can have multiple rows per race from different riders)
  const racesBySlug = new Map<string, { slug: string; name: string; date: string }>();
  for (const r of pastRows ?? []) {
    if (!racesBySlug.has(r.race_slug)) {
      racesBySlug.set(r.race_slug, { slug: r.race_slug, name: r.race_name, date: r.race_date });
    }
  }
  for (const r of futureRows ?? []) {
    if (!racesBySlug.has(r.race_slug)) {
      racesBySlug.set(r.race_slug, { slug: r.race_slug, name: r.race_name, date: r.race_date });
    }
  }

  // Filter out non-World-Tour races
  for (const slug of Array.from(racesBySlug.keys())) {
    const parent = getParentRaceSlug(slug); // null for one-day races
    if (!WT_PARENT_SLUGS.has(parent ?? slug)) {
      racesBySlug.delete(slug);
    }
  }

  // Inject GT stage schedule for future stages (no race_startlists per-stage entries exist)
  if (isGtPhase) {
    const GT_SLUG_MAP = { 4: "giro-d-italia", 6: "tour-de-france", 8: "vuelta-a-espana" } as const;
    const GT_NAME_MAP = {
      "giro-d-italia": "Giro d'Italia",
      "tour-de-france": "Tour de France",
      "vuelta-a-espana": "Vuelta a España",
    } as const;
    const gtSlug = GT_SLUG_MAP[phase.id as 4 | 6 | 8];
    const year = referenceDate.getFullYear();
    const schedule = GT_SCHEDULES[`${gtSlug}/${year}`] ?? [];
    const gtName = GT_NAME_MAP[gtSlug];
    for (const entry of schedule) {
      if (entry.date < phaseStartIso || entry.date > phaseEndIso) continue;
      const slug = `race/${gtSlug}/${year}/stage-${entry.number}`;
      if (racesBySlug.has(slug)) continue;
      racesBySlug.set(slug, { slug, name: `${gtName} - Stage ${entry.number}`, date: entry.date });
    }
  }

  if (racesBySlug.size === 0) {
    // Empty feed (new league / between phases): still surface the upcoming phase instead of
    // falling through to the "Season over" banner.
    const { nextPhaseRound1Date, nextPhaseLabel } = await computeNextPhase(
      supabase,
      opts.leagueId,
      phase.id,
      referenceDate.getFullYear()
    );
    return { groups: [], nextPhaseRound1Date, nextPhaseLabel, isGtPhase, phaseId: phase.id };
  }

  // 2) Fetch team and rider lookup tables
  const { data: teamRows = [] } = await supabase
    .from("teams")
    .select("id, name, equipped_achievement_slug")
    .eq("league_id", opts.leagueId);
  const teamById = new Map<string, string>();
  const teamEquippedSlugById = new Map<string, string | null>();
  for (const t of teamRows ?? []) {
    teamById.set(t.id, t.name);
    teamEquippedSlugById.set(t.id, (t as { equipped_achievement_slug?: string | null }).equipped_achievement_slug ?? null);
  }
  const leagueTeamIds = Array.from(teamById.keys());

  const { data: riderRows = [] } = await supabase
    .from("riders")
    .select("id, full_name");
  const riderById = new Map<string, string>();
  for (const r of riderRows ?? []) riderById.set(r.id, r.full_name);

  // 3) Fetch XP and bonus data for past+today races only
  const slugsForXp = Array.from(racesBySlug.values())
    .filter((r) => r.date <= todayIso)
    .map((r) => r.slug);

  const { data: xpRows = [] } =
    slugsForXp.length === 0 || leagueTeamIds.length === 0
      ? { data: [] as any[] }
      : await supabase
          .from("rider_xp_daily")
          .select("race_slug, team_id, rider_id, xp_gained")
          .in("race_slug", slugsForXp)
          .in("team_id", leagueTeamIds);

  const { data: bonusRows = [] } =
    slugsForXp.length === 0 || leagueTeamIds.length === 0
      ? { data: [] as any[] }
      : await supabase
          .from("sponsor_bonuses")
          .select("race_slug, team_id, rider_id, final_bonus")
          .in("race_slug", slugsForXp)
          .in("team_id", leagueTeamIds);

  const { data: goalRows = [] } =
    slugsForXp.length === 0 || leagueTeamIds.length === 0
      ? { data: [] as any[] }
      : await (supabase as any)
          .from("sponsor_goal_completions")
          .select("stage_slug, team_id, rider_id, final_reward")
          .in("stage_slug", slugsForXp)
          .in("team_id", leagueTeamIds);

  // Aggregate XP + bonus by (race_slug, team_id, rider_id)
  type Agg = { xp: number; bonus: number };
  const aggKey = (race: string, team: string, rider: string) => `${race}\x00${team}\x00${rider}`;
  const agg = new Map<string, Agg>();
  for (const row of xpRows ?? []) {
    const k = aggKey(row.race_slug, row.team_id, row.rider_id);
    const cur = agg.get(k) ?? { xp: 0, bonus: 0 };
    cur.xp += Number(row.xp_gained ?? 0);
    agg.set(k, cur);
  }
  for (const row of bonusRows ?? []) {
    const k = aggKey(row.race_slug, row.team_id, row.rider_id);
    const cur = agg.get(k) ?? { xp: 0, bonus: 0 };
    cur.bonus += Number(row.final_bonus ?? 0);
    agg.set(k, cur);
  }
  for (const row of goalRows ?? []) {
    if (!row.stage_slug || !row.rider_id) continue;
    const k = aggKey(row.stage_slug, row.team_id, row.rider_id);
    const cur = agg.get(k) ?? { xp: 0, bonus: 0 };
    cur.bonus += Number(row.final_reward ?? 0);
    agg.set(k, cur);
  }

  // 4) Build per-race breakdown helper
  const buildBreakdown = (raceSlug: string): {
    teams: TeamRaceResult[];
    winnerTeamId: string | null;
    winnerTeamInitials: string | null;
    winnerTeamName: string | null;
    winnerTeamBadgeUrl: string | null;
    winnerTeamBannerUrl: string | null;
    winnerTeamAchievementName: string | null;
    winnerTeamAchievementTier: import("./achievements").AchievementTier | null;
  } => {
    const byTeam = new Map<string, RiderRaceResult[]>();
    for (const [k, v] of agg.entries()) {
      const parts = k.split("\x00");
      const [slug, teamId, riderId] = parts;
      if (slug !== raceSlug) continue;
      if (v.xp < 1 && v.bonus < 1) continue;
      const list = byTeam.get(teamId!) ?? [];
      list.push({
        riderId: riderId!,
        riderShortName: shortenRiderName(riderById.get(riderId!) ?? riderId!),
        role: null,
        xpGained: v.xp,
        bonusEur: v.bonus,
      });
      byTeam.set(teamId!, list);
    }
    const teams: TeamRaceResult[] = [];
    for (const [teamId, riders] of byTeam.entries()) {
      const totalXp = riders.reduce((s, r) => s + r.xpGained, 0);
      const totalBonus = riders.reduce((s, r) => s + r.bonusEur, 0);
      teams.push({
        teamId,
        teamName: teamById.get(teamId) ?? "?",
        isMyTeam: teamId === opts.myTeamId,
        totalXp,
        totalBonusEur: totalBonus,
        riders: riders.sort((a, b) => b.xpGained - a.xpGained),
      });
    }
    teams.sort((a, b) => b.totalXp - a.totalXp);
    const winner = teams[0] ?? null;
    const winnerEquippedSlug = winner ? (teamEquippedSlugById.get(winner.teamId) ?? null) : null;
    const winnerAchievement = winnerEquippedSlug ? getAchievementBySlug(winnerEquippedSlug) : undefined;
    return {
      teams,
      winnerTeamId: winner?.teamId ?? null,
      winnerTeamInitials: winner ? teamInitials(winner.teamName) : null,
      winnerTeamName: winner?.teamName ?? null,
      winnerTeamBadgeUrl: winnerAchievement?.badgeUrl ?? null,
      winnerTeamBannerUrl: winnerAchievement?.bannerUrl ?? null,
      winnerTeamAchievementName: winnerAchievement?.name ?? null,
      winnerTeamAchievementTier: winnerAchievement?.tier ?? null,
    };
  };

  // 5) Build base race data helper
  const buildBaseRace = (slug: string, name: string, date: string): RaceData => {
    const raceType = detectRaceType(slug);
    const parentSlug = getParentRaceSlug(slug);
    const parentLabel = parentSlug ? getParentRaceLabel(parentSlug) : null;
    let status: RaceCardStatus;
    if (date < todayIso) {
      status = "past";
    } else if (date > todayIso) {
      status = "future";
    } else if (scoredSlugs.has(slug)) {
      status = "today"; // scored today → show results card
    } else if (cutoffPassed) {
      status = "in_progress"; // unscored, after 11h → race underway
    } else {
      status = "future"; // unscored, before 11h → tactic button available
    }
    return {
      raceSlug: slug,
      raceName: name,
      raceTitle: formatRaceTitle({ raceType, raceName: name, raceSlug: slug, parentRaceLabel: parentLabel }),
      parentRaceSlug: parentSlug,
      parentRaceLabel: parentLabel,
      raceDate: date,
      raceType,
      status,
      isGtPhase,
    };
  };

  // 6) Group all cards by date
  const byDate = new Map<string, RaceFeedCard[]>();
  const pushCard = (date: string, card: RaceFeedCard) => {
    const list = byDate.get(date) ?? [];
    list.push(card);
    byDate.set(date, list);
  };

  for (const r of racesBySlug.values()) {
    const base = buildBaseRace(r.slug, r.name, r.date);
    if (base.status === "future" || base.status === "in_progress") {
      pushCard(r.date, { type: base.status, race: base });
    } else {
      const breakdown = buildBreakdown(r.slug);
      const enriched: RaceDataWithBreakdown = { ...base, ...breakdown };
      pushCard(r.date, { type: base.status as "past" | "today", race: enriched });
    }
  }

  // 7) Inject rest day cards (GT phases only)
  if (isGtPhase) {
    const GT_SLUG_MAP_RD = { 4: "giro-d-italia", 6: "tour-de-france", 8: "vuelta-a-espana" } as const;
    const GT_NAME_MAP_RD = {
      "giro-d-italia": "Giro d'Italia",
      "tour-de-france": "Tour de France",
      "vuelta-a-espana": "Vuelta a España",
    } as const;
    const gtSlugRd = GT_SLUG_MAP_RD[phase.id as 4 | 6 | 8];
    const yearRd = referenceDate.getFullYear();
    const gtNameRd = GT_NAME_MAP_RD[gtSlugRd];
    const restDays = GT_REST_DAYS[`${gtSlugRd}/${yearRd}`] ?? [];
    for (const date of restDays) {
      if (date < phaseStartIso || date > phaseEndIso) continue;
      pushCard(date, { type: "rest_day", date, gtName: gtNameRd });
    }
  }

  // 8) Fetch and slot Nemesis cards (GT phases only)
  if (isGtPhase) {
    const { data: nemRows = [] } = await supabase
      .from("gt_tactic_activations")
      .select(
        "id, team_id, stage_slug, tactic_type, nemesis_target_team_id, nemesis_target_role, outcome, resolved_attacker_rider_id, resolved_target_rider_id"
      )
      .eq("phase_id", phase.id)
      .in("tactic_type", ["nemesis_gc", "nemesis_sprint"]);

    for (const row of nemRows ?? []) {
      const race = racesBySlug.get(row.stage_slug);
      if (!race) continue;
      const isMyTeamAttacker = row.team_id === opts.myTeamId;
      const data: NemesisData = {
        activationId: row.id,
        raceSlug: row.stage_slug,
        nemesisType: row.tactic_type === "nemesis_gc" ? "gc" : "sprint",
        attackerTeamName: teamById.get(row.team_id) ?? "?",
        attackerRiderShortName: row.resolved_attacker_rider_id
          ? shortenRiderName(riderById.get(row.resolved_attacker_rider_id) ?? "?")
          : "?",
        targetTeamName: teamById.get(row.nemesis_target_team_id ?? "") ?? "?",
        targetRiderShortName: row.resolved_target_rider_id
          ? shortenRiderName(riderById.get(row.resolved_target_rider_id) ?? "?")
          : "?",
        outcome: (row.outcome as NemesisData["outcome"]) ?? "pending",
        isMyTeamAttacker,
      };
      pushCard(race.date, { type: "nemesis", data, raceSlug: row.stage_slug });
    }
  }

  // 9) Build sorted groups
  const groups: RaceFeedDateGroup[] = Array.from(byDate.keys())
    .sort()
    .map((date) => ({ date, cards: byDate.get(date)! }));

  // 10) Compute next phase Round 1 date
  const { nextPhaseRound1Date, nextPhaseLabel } = await computeNextPhase(
    supabase,
    opts.leagueId,
    phase.id,
    referenceDate.getFullYear()
  );

  return { groups, nextPhaseRound1Date, nextPhaseLabel, isGtPhase, phaseId: phase.id };
}

// Resolves the next phase label + its Round 1 date (actual auction date if one is scheduled,
// else the phase calendar start). Independent of the current phase's race list, so it can run
// even when the feed is empty (brand-new league, between phases) — otherwise the home screen
// wrongly shows "Season over" instead of the upcoming phase.
async function computeNextPhase(
  supabase: SupabaseClient,
  leagueId: string,
  currentPhaseId: number,
  referenceYear: number
): Promise<{ nextPhaseRound1Date: string | null; nextPhaseLabel: string | null }> {
  const nextPhase = AUCTION_PHASES.find((p) => p.id === currentPhaseId + 1) ?? null;
  if (!nextPhase) return { nextPhaseRound1Date: null, nextPhaseLabel: null };

  const nextStartIso = new Date(referenceYear, nextPhase.startMonth - 1, nextPhase.startDay)
    .toISOString()
    .slice(0, 10);
  const { data: auctionRows = [] } = await supabase
    .from("auctions")
    .select("opens_at")
    .eq("league_id", leagueId)
    .gte("opens_at", nextStartIso)
    .order("opens_at", { ascending: true })
    .limit(1);

  const nextPhaseRound1Date =
    auctionRows && auctionRows.length > 0
      ? (auctionRows[0].opens_at as string).slice(0, 10)
      : nextStartIso;
  return { nextPhaseRound1Date, nextPhaseLabel: nextPhase.label };
}

function isCutoffPassedCET(): boolean {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Paris",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  return h * 60 + m >= 11 * 60;
}
