// Anti-Runaway Mechanism 2: Co-Unlock Rule.
// Spec: docs/plans/2026-04-23-anti-runaway-system-design.md §4

import { LEVELS } from "@/lib/levels";

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
