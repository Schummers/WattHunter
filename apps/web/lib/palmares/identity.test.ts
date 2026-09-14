import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPlayerIdentities } from "./identity";

/**
 * A query builder that actually applies `eq` / `neq` / `in` / `range`, so a test
 * can prove the perimeter filters (no demo league, no pending league) are there:
 * a builder that ignored them would pass with the filters deleted.
 */
function fakeSupabase(tables: Record<string, Record<string, unknown>[]>): SupabaseClient {
  const builder = (rows: Record<string, unknown>[]) => {
    let current = rows;
    const chain: Record<string, unknown> = {
      select: () => chain,
      order: () => chain,
      eq: (field: string, value: unknown) => {
        current = current.filter((row) => row[field] === value);
        return chain;
      },
      neq: (field: string, value: unknown) => {
        current = current.filter((row) => row[field] !== value);
        return chain;
      },
      in: (field: string, values: unknown[]) => {
        current = current.filter((row) => values.includes(row[field]));
        return chain;
      },
      range: (from: number, to: number) => {
        const page = current.slice(from, to + 1);
        return Promise.resolve({ data: page, error: null });
      },
      then: (resolve: (value: { data: unknown[] }) => unknown) => resolve({ data: current }),
    };
    return chain;
  };
  return {
    from: (table: string) => builder(tables[table] ?? []),
  } as unknown as SupabaseClient;
}

const LEAGUES = [
  { id: "v1", created_at: "2026-03-08T00:00:00Z", season_year: 2026, is_demo: false, status: "active" },
  { id: "v2", created_at: "2026-06-25T00:00:00Z", season_year: 2026, is_demo: false, status: "active" },
  { id: "demo", created_at: "2026-07-01T00:00:00Z", season_year: 2026, is_demo: true, status: "active" },
  { id: "draft", created_at: "2026-08-01T00:00:00Z", season_year: 2026, is_demo: false, status: "pending" },
];

const TEAMS = [
  { id: "t1", league_id: "v1", name: "Muscat Romain", equipped_achievement_slug: null },
  { id: "t2", league_id: "v2", name: "Muskatel Muskadji", equipped_achievement_slug: null },
  { id: "t3", league_id: "demo", name: "Flamme Rouge", equipped_achievement_slug: null },
  { id: "t4", league_id: "draft", name: "Never Launched", equipped_achievement_slug: null },
];

const MEMBERS = [
  { team_id: "t1", league_id: "v1", users: { display_name: "Muscat Romain" } },
  { team_id: "t2", league_id: "v2", users: { display_name: "Muscat Romain" } },
  { team_id: "t3", league_id: "demo", users: { display_name: "Muscat Romain" } },
  { team_id: "t4", league_id: "draft", users: { display_name: "Muscat Romain" } },
];

describe("loadPlayerIdentities", () => {
  it("takes the team of the most recent league by default", async () => {
    const identities = await loadPlayerIdentities(
      fakeSupabase({ leagues: LEAGUES, teams: TEAMS, league_members: MEMBERS }),
      { seasonYear: 2026 },
    );
    expect(identities.get("Muscat Romain")?.label).toBe("Muskatel Muskadji");
  });

  it("lets the league being browsed win over a more recent one", async () => {
    const identities = await loadPlayerIdentities(
      fakeSupabase({ leagues: LEAGUES, teams: TEAMS, league_members: MEMBERS }),
      { seasonYear: 2026, preferLeagueId: "v1" },
    );
    expect(identities.get("Muscat Romain")?.label).toBe("Muscat Romain");
  });

  it("knows nothing of a player who never opened an account", async () => {
    const identities = await loadPlayerIdentities(
      fakeSupabase({ leagues: LEAGUES, teams: TEAMS, league_members: MEMBERS }),
      { seasonYear: 2026 },
    );
    // The caller falls back on the archive name, which is what the Ranking and
    // the Palmares both do for a former player.
    expect(identities.has("Fangio")).toBe(false);
  });

  it("ignores the demo league and a league never launched", async () => {
    const identities = await loadPlayerIdentities(
      fakeSupabase({ leagues: LEAGUES, teams: TEAMS, league_members: MEMBERS }),
      { seasonYear: 2026 },
    );
    // Both are more recent than V2 and would win the label if they counted.
    expect(identities.get("Muscat Romain")?.label).toBe("Muskatel Muskadji");
  });

  it("returns nothing when the season has no real league", async () => {
    const identities = await loadPlayerIdentities(
      fakeSupabase({ leagues: [], teams: TEAMS, league_members: MEMBERS }),
      { seasonYear: 2026 },
    );
    expect(identities.size).toBe(0);
  });
});
