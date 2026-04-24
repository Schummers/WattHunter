// Anti-Runaway Mechanism 2: Co-Unlock Rule.
// Spec: docs/plans/2026-04-23-anti-runaway-system-design.md §4

import { LEVELS } from "@/lib/levels";
import { createClient } from "@/lib/supabase/server";

/**
 * Return the lowest level (1..8) whose pool includes this rider's PCS rank.
 *
 * A level's `poolMin` is the BEST rank that level can access (e.g., Lv.8 poolMin=1).
 * A rider of rank R is accessible from any level L where poolMin(L) <= R.
 * We return the HIGHEST such level's number — i.e., the minimum level the rider
 * requires (since lower levels have higher poolMin and can't reach tight ranks).
 *
 * Example: rank 5 — Lv.7 poolMin=4 (can access), Lv.6 poolMin=10 (cannot). Returns 7.
 */
export function getMinLevelForRiderRank(pcsRank: number): number {
  // Iterate highest → lowest level. Return the highest level where poolMin <= rank
  // (which is equivalent to the "minimum level needed").
  // Actually: we want the SMALLEST level L such that poolMin(L) <= rank.
  // Since poolMin decreases as L increases (Lv.1=300, Lv.8=1), smallest L with
  // poolMin(L) <= rank is the first L (ascending) that meets the condition.
  for (const l of LEVELS) {
    if (l.poolMin <= pcsRank) return l.level;
  }
  return 1; // fallback — rank out of pool entirely, doesn't gate bidding on its own
}

export type CoUnlockStatus = {
  minLevel: number;
  playersAtOrAboveLevel: number;
  playersNeededToUnlock: number; // how many more need to reach minLevel
  isUnlocked: boolean;
};

/** Pure function — given team levels and a rider rank, return whether bidding is unlocked. */
export function computeCoUnlockStatus(args: {
  riderPcsRank: number | null;
  leagueTeamLevels: number[];
  playersRequired?: number; // defaults to 2 per spec §4.1
}): CoUnlockStatus {
  const playersRequired = args.playersRequired ?? 2;

  // No rank → no co-unlock gate. Keep the rider open.
  if (args.riderPcsRank == null) {
    return {
      minLevel: 1,
      playersAtOrAboveLevel: args.leagueTeamLevels.length,
      playersNeededToUnlock: 0,
      isUnlocked: true,
    };
  }

  const minLevel = getMinLevelForRiderRank(args.riderPcsRank);
  const playersAtOrAboveLevel = args.leagueTeamLevels.filter(
    (l) => l >= minLevel,
  ).length;
  const playersNeededToUnlock = Math.max(
    0,
    playersRequired - playersAtOrAboveLevel,
  );
  return {
    minLevel,
    playersAtOrAboveLevel,
    playersNeededToUnlock,
    isUnlocked: playersAtOrAboveLevel >= playersRequired,
  };
}

/**
 * Fetch the list of team levels in a league. Used to compute co-unlock status for
 * multiple riders in one call (fetch once, compute many).
 */
export async function fetchLeagueTeamLevels(leagueId: string): Promise<number[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("level")
    .eq("league_id", leagueId);
  if (error || !data) return [];
  return data.map((t) => t.level ?? 1);
}

/**
 * Server-side convenience: fetch team levels once, return a status function.
 * Use this in page components when you want to compute lock status for many riders.
 */
export async function buildCoUnlockChecker(
  leagueId: string,
): Promise<(riderPcsRank: number | null) => CoUnlockStatus> {
  const levels = await fetchLeagueTeamLevels(leagueId);
  return (riderPcsRank) =>
    computeCoUnlockStatus({
      riderPcsRank,
      leagueTeamLevels: levels,
    });
}
