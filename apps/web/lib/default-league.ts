// TEMPORARY (TdF Classic V2 playtest): force Classic V2 as the default league
// so it opens first for players who belong to it. Other leagues stay reachable
// via the league switcher. Revert after the playtest by deleting this file and
// restoring the `.limit(1)` queries in app/page.tsx and app/auth/callback/route.ts.
export const PREFERRED_DEFAULT_LEAGUE_ID =
  "00000000-0000-4000-8000-c1a551c2026e";

// Returns the preferred default league if the user is a member of it,
// otherwise the first membership (previous behaviour).
export function pickDefaultLeagueId(
  leagueIds: string[],
): string | undefined {
  if (leagueIds.includes(PREFERRED_DEFAULT_LEAGUE_ID)) {
    return PREFERRED_DEFAULT_LEAGUE_ID;
  }
  return leagueIds[0];
}
