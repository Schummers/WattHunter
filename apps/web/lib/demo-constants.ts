export const DEMO_LEAGUE_SLUG = "demo" as const;
export const DEMO_LEAGUE_ID = "00000000-0000-4000-8000-d3110d3110d3" as const;

export const DEMO_TEAM_IDS = [
  "00000000-0000-4000-8000-d3110d311001",
  "00000000-0000-4000-8000-d3110d311002",
  "00000000-0000-4000-8000-d3110d311003",
  "00000000-0000-4000-8000-d3110d311004",
  "00000000-0000-4000-8000-d3110d311005",
  "00000000-0000-4000-8000-d3110d311006",
  "00000000-0000-4000-8000-d3110d311007",
  "00000000-0000-4000-8000-d3110d311008",
] as const;

export const DEMO_USER_IDS = [
  "00000000-0000-4000-8000-d3110d310001",
  "00000000-0000-4000-8000-d3110d310002",
  "00000000-0000-4000-8000-d3110d310003",
  "00000000-0000-4000-8000-d3110d310004",
  "00000000-0000-4000-8000-d3110d310005",
  "00000000-0000-4000-8000-d3110d310006",
  "00000000-0000-4000-8000-d3110d310007",
  "00000000-0000-4000-8000-d3110d310008",
] as const;

export const DEMO_TEAM_NAMES = [
  "Flamme Rouge",
  "Les Grimpeurs",
  "Cinq Etoiles",
  "Bidon Vert",
  "Echappee Belle",
  "Pave Royal",
  "Maillot Jaune",
  "Domestique XI",
] as const;

export const DEMO_VISITOR_TEAM_INDEX = 1 as const;
export const DEMO_VISITOR_TEAM_ID = DEMO_TEAM_IDS[DEMO_VISITOR_TEAM_INDEX];

/**
 * Returns true when the input refers to the demo league.
 * Accepts either the URL slug (`"demo"`, used in route params) or the
 * DB UUID (`DEMO_LEAGUE_ID`, used as a foreign-key value). Callers don't
 * have to know which form they hold.
 */
export function isDemoLeague(leagueIdOrSlug: string): boolean {
  return leagueIdOrSlug === DEMO_LEAGUE_SLUG || leagueIdOrSlug === DEMO_LEAGUE_ID;
}
