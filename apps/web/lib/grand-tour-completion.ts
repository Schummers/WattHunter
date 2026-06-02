// Grand Tour completion gate for jersey achievements.
//
// A Grand Tour jersey (GC / KOM / Points) is only "won" once the race is
// finished AND fully synced. Jersey achievements are evaluated on every page
// load from live data, so without a completion gate the *current* jersey
// holder on the latest synced stage is wrongly treated as the final winner.
//
// Two independent completion signals, BOTH required (defense in depth):
//   A) the final stage (GT_FINAL_STAGE) daily classification is in the DB
//   B) the final GC has been scored — PCS only assigns GC pcs_points after the
//      last stage, so any `/gc` race_results row with pcs_points > 0 proves the
//      race is over and the GC has been synced.

// Every Grand Tour (Giro, Tour, Vuelta) is 21 stages.
export const GT_FINAL_STAGE = 21;

type StageRow = { race_slug: string; stage: string | null };
type ScoredGcRow = { race_slug: string };

/**
 * Returns the set of years (as strings) for which the given Grand Tour is
 * complete and fully synced — and therefore safe to award jersey achievements.
 *
 * @param base          GT base slug, e.g. "giro-d-italia"
 * @param stageRows     all `gt_daily_classifications` stage rows for the GT
 *                      across every rider (NOT scoped to one team)
 * @param scoredGcRows  `race_results` `/gc` rows for the GT with pcs_points > 0
 */
export function completedGrandTourYears(
  base: string,
  stageRows: StageRow[],
  scoredGcRows: ScoredGcRow[],
): Set<string> {
  const yearRe = new RegExp(`${base}\\/(\\d{4})\\/`);

  // Signal A — highest synced stage number per year.
  const maxStageByYear = new Map<string, number>();
  for (const row of stageRows) {
    const stageMatch = row.stage?.match(/stage-(\d+)/);
    const yearMatch = row.race_slug.match(yearRe);
    if (!stageMatch || !yearMatch) continue;
    const year = yearMatch[1];
    const n = parseInt(stageMatch[1], 10);
    if ((maxStageByYear.get(year) ?? 0) < n) maxStageByYear.set(year, n);
  }

  // Signal B — years whose final GC has been scored.
  const scoredYears = new Set<string>();
  for (const row of scoredGcRows) {
    const yearMatch = row.race_slug.match(yearRe);
    if (yearMatch) scoredYears.add(yearMatch[1]);
  }

  const completed = new Set<string>();
  for (const [year, maxStage] of maxStageByYear) {
    if (maxStage >= GT_FINAL_STAGE && scoredYears.has(year)) completed.add(year);
  }
  return completed;
}
