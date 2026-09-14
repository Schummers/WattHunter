import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPlayerIdentities } from "./identity";

/**
 * A query builder that ignores every filter and answers with the rows of the
 * table. The filters are the caller's business and are asserted by reading the
 * code, not by re-implementing PostgREST here.
 */
function fakeSupabase(tables: Record<string, unknown[]>): SupabaseClient {
  const builder = (rows: unknown[]) => {
    const chain: Record<string, unknown> = {
      then: (resolve: (value: { data: unknown[] }) => unknown) => resolve({ data: rows }),
    };
    for (const method of ["select", "eq", "neq", "in", "order"]) {
      chain[method] = () => chain;
    }
    return chain;
  };
  return {
    from: (table: string) => builder(tables[table] ?? []),
  } as unknown as SupabaseClient;
}

const LEAGUES = [
  { id: "v1", created_at: "2026-03-08T00:00:00Z" },
  { id: "v2", created_at: "2026-06-25T00:00:00Z" },
];

const TEAMS = [
  { id: "t1", league_id: "v1", name: "Muscat Romain", equipped_achievement_slug: null },
  { id: "t2", league_id: "v2", name: "Muskatel Muskadji", equipped_achievement_slug: null },
];

const MEMBERS = [
  { team_id: "t1", users: { display_name: "Muscat Romain" } },
  { team_id: "t2", users: { display_name: "Muscat Romain" } },
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

  it("returns nothing when the season has no real league", async () => {
    const identities = await loadPlayerIdentities(
      fakeSupabase({ leagues: [], teams: TEAMS, league_members: MEMBERS }),
      { seasonYear: 2026 },
    );
    expect(identities.size).toBe(0);
  });
});
