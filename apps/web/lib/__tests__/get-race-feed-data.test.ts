import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRaceFeedData } from "../get-race-feed-data";


// Prevent server-only from throwing in test environment
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({}));
vi.mock("@supabase/ssr", () => ({}));

type RowSet = Record<string, any[]>;

function buildSupabase(rows: RowSet) {
  const builder = (table: string) => {
    const data = rows[table] ?? [];
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: data[0] ?? null, error: null }),
      then: (resolve: any) => resolve({ data, error: null }),
    };
    return chain;
  };
  return { from: vi.fn(builder) } as any;
}

describe("getRaceFeedData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty groups + null next phase when no races, no auctions (non-GT phase)", async () => {
    // Feb 1 is not a GT phase (phases 4/6/8 are GT) — GT schedule injection is skipped
    const supabase = buildSupabase({});
    const result = await getRaceFeedData(supabase, {
      leagueId: "L1",
      myTeamId: "T1",
      referenceDate: new Date("2026-02-01T08:00:00Z"),
    });
    expect(result.groups).toEqual([]);
    expect(result.nextPhaseRound1Date).toBeNull();
    expect(result.isGtPhase).toBe(false);
  });

  it("injects GT future stages from static schedule in GT phases", async () => {
    // May 5 is phase 4 (Giro) — a GT phase — with no DB race data
    const supabase = buildSupabase({
      race_results: [],
      race_startlists: [],
      rider_xp_daily: [],
      sponsor_bonuses: [],
      teams: [],
      riders: [],
      gt_tactic_activations: [],
      remontada_boosts: [],
      auctions: [],
    });
    const result = await getRaceFeedData(supabase, {
      leagueId: "L1",
      myTeamId: "T1",
      referenceDate: new Date("2026-05-05T08:00:00Z"),
    });
    expect(result.isGtPhase).toBe(true);
    expect(result.phaseId).toBe(4);
    // All Giro stages from May 5 onwards should appear as future cards
    expect(result.groups.length).toBeGreaterThan(0);
    const allCards = result.groups.flatMap((g) => g.cards);
    expect(allCards.every((c) => c.type === "future")).toBe(true);
    const slugs = allCards.map((c) => (c.type === "future" ? c.race.raceSlug : ""));
    expect(slugs.some((s) => s.includes("giro-d-italia") && s.includes("stage-"))).toBe(true);
  });

  it("groups today's stage card and yesterday's past card", async () => {
    const supabase = buildSupabase({
      race_results: [
        {
          race_slug: "race/giro-d-italia/2026/stage-1",
          race_name: "Giro d'Italia - Stage 1",
          race_date: "2026-05-04",
        },
        {
          race_slug: "race/giro-d-italia/2026/stage-2",
          race_name: "Giro d'Italia - Stage 2",
          race_date: "2026-05-05",
        },
      ],
      race_startlists: [],
      rider_xp_daily: [
        { race_slug: "race/giro-d-italia/2026/stage-1", team_id: "T_other", rider_id: "r1", xp_gained: 200 },
        { race_slug: "race/giro-d-italia/2026/stage-2", team_id: "T1", rider_id: "r2", xp_gained: 120 },
        { race_slug: "race/giro-d-italia/2026/stage-2", team_id: "T_other", rider_id: "r3", xp_gained: 90 },
      ],
      teams: [
        { id: "T1", name: "Mon équipe" },
        { id: "T_other", name: "Team Astrid" },
      ],
      riders: [
        { id: "r1", full_name: "Tadej Pogacar" },
        { id: "r2", full_name: "Mathieu van Aert" },
        { id: "r3", full_name: "Jonas Vingegaard" },
      ],
      sponsor_bonuses: [],
      gt_tactic_activations: [],
      remontada_boosts: [],
      auctions: [],
    });

    const result = await getRaceFeedData(supabase, {
      leagueId: "L1",
      myTeamId: "T1",
      referenceDate: new Date("2026-05-05T08:00:00Z"),
    });

    // GT injection adds future stages (May 8+) — so there are more than 2 groups
    const dates = result.groups.map((g) => g.date);
    expect(dates).toContain("2026-05-04");
    expect(dates).toContain("2026-05-05");

    const pastGroup = result.groups.find((g) => g.date === "2026-05-04")!;
    expect(pastGroup.cards[0].type).toBe("past");

    const todayGroup = result.groups.find((g) => g.date === "2026-05-05")!;
    const todayCard = todayGroup.cards[0];
    expect(todayCard.type).toBe("today");
    if (todayCard.type !== "today" && todayCard.type !== "past") return;
    const myTeam = todayCard.race.teams.find((t) => t.isMyTeam);
    expect(myTeam).toBeDefined();
    expect(myTeam?.totalXp).toBe(120);
  });

  it("intercalates Nemesis cards in the same date group as their stage", async () => {
    const supabase = buildSupabase({
      race_results: [
        {
          race_slug: "race/giro-d-italia/2026/stage-2",
          race_name: "Giro - Stage 2",
          race_date: "2026-05-05",
        },
      ],
      race_startlists: [],
      rider_xp_daily: [],
      teams: [
        { id: "T1", name: "Mon équipe" },
        { id: "T_other", name: "Team Astrid" },
      ],
      riders: [],
      sponsor_bonuses: [],
      gt_tactic_activations: [
        {
          id: "act-1",
          team_id: "T1",
          stage_slug: "race/giro-d-italia/2026/stage-2",
          tactic_type: "nemesis_gc",
          nemesis_target_team_id: "T_other",
          nemesis_target_role: "gc_leader",
          outcome: "attacker_won",
          resolved_attacker_rider_id: null,
          resolved_target_rider_id: null,
        },
      ],
      remontada_boosts: [],
      auctions: [],
    });

    const result = await getRaceFeedData(supabase, {
      leagueId: "L1",
      myTeamId: "T1",
      referenceDate: new Date("2026-05-05T08:00:00Z"),
    });

    // May 5 group has stage-2 + nemesis card
    const todayGroup = result.groups.find((g) => g.date === "2026-05-05")!;
    expect(todayGroup).toBeDefined();
    const nemesis = todayGroup.cards.find((c) => c.type === "nemesis");
    expect(nemesis).toBeDefined();
    if (nemesis?.type !== "nemesis") return;
    expect(nemesis.data.outcome).toBe("attacker_won");
    expect(nemesis.data.isMyTeamAttacker).toBe(true);
  });
});
