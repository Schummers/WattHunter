import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRaceFeedData } from "../get-race-feed-data";


// Prevent server-only from throwing in test environment
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({}));
vi.mock("@supabase/ssr", () => ({}));

type RowSet = Record<string, any[]>;

function buildSupabase(rows: RowSet) {
  const builder = (table: string) => {
    const allRows = rows[table] ?? [];
    // `range` slices like PostgREST does, so tests exercise the real pagination loop.
    let data = allRows;
    const chain: any = {
      range: vi.fn((from: number, to: number) => {
        data = allRows.slice(from, to + 1);
        return chain;
      }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: allRows[0] ?? null, error: null }),
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

  it("returns empty groups but still surfaces the next phase when no races (non-GT phase)", async () => {
    // Feb 1 is not a GT phase (phases 4/6/8 are GT) — GT schedule injection is skipped.
    // Even with an empty feed, the upcoming phase must be resolved (no "Season over").
    const supabase = buildSupabase({});
    const result = await getRaceFeedData(supabase, {
      leagueId: "L1",
      myTeamId: "T1",
      referenceDate: new Date("2026-02-01T08:00:00Z"),
    });
    expect(result.groups).toEqual([]);
    expect(result.isGtPhase).toBe(false);
    // No auctions scheduled → falls back to the next phase's calendar start date + label.
    expect(result.nextPhaseRound1Date).not.toBeNull();
    expect(result.nextPhaseLabel).toBeTruthy();
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
    expect(allCards.every((c) => c.type === "future" || c.type === "rest_day")).toBe(true);
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

  it("pages past the PostgREST 1000-row cap on rider_xp_daily", async () => {
    // A full Tour phase exceeds 1000 XP rows for a league. Without pagination the
    // feed silently loses rows spread across every stage, so stage winners vanish.
    const stageSlug = "race/giro-d-italia/2026/stage-2";
    const filler = Array.from({ length: 1200 }, (_, i) => ({
      race_slug: stageSlug,
      team_id: "T_other",
      rider_id: `filler-${i}`,
      xp_gained: 1,
    }));

    const supabase = buildSupabase({
      race_results: [
        { race_slug: stageSlug, race_name: "Giro - Stage 2", race_date: "2026-05-05" },
      ],
      race_startlists: [],
      rider_xp_daily: [
        ...filler,
        { race_slug: stageSlug, team_id: "T1", rider_id: "r_late", xp_gained: 176.5 },
      ],
      teams: [
        { id: "T1", name: "Mon équipe" },
        { id: "T_other", name: "Team Astrid" },
      ],
      riders: [{ id: "r_late", full_name: "Tadej Pogacar" }],
      sponsor_bonuses: [],
      gt_tactic_activations: [],
      auctions: [],
    });

    const result = await getRaceFeedData(supabase, {
      leagueId: "L1",
      myTeamId: "T1",
      referenceDate: new Date("2026-05-05T08:00:00Z"),
    });

    const todayCard = result.groups
      .find((g) => g.date === "2026-05-05")!
      .cards.find((c) => c.type === "today");
    expect(todayCard?.type).toBe("today");
    if (todayCard?.type !== "today") return;
    const myTeam = todayCard.race.teams.find((t) => t.isMyTeam);
    expect(myTeam?.riders.map((r) => r.riderShortName)).toContain("T. Pogacar");
    expect(myTeam?.totalXp).toBe(176.5);
  });

  it("emits a card per final jersey next to the GC, in classification order", async () => {
    // The three jerseys have no race_results row (they live in gt_final_classifications),
    // so the feed has to inject them or they never get a card at all.
    const gt = "race/vuelta-a-espana/2026";
    const supabase = buildSupabase({
      race_results: [
        { race_slug: `${gt}/stage-21`, race_name: "La Vuelta \u2014 Stage 21", race_date: "2026-09-13" },
        {
          race_slug: `${gt}/gc`,
          race_name: "La Vuelta Ciclista a Espa\u00f1a \u2014 Stage 21 - GC",
          race_date: "2026-09-13",
        },
      ],
      race_startlists: [],
      gt_final_classifications: [
        { race_slug: `${gt}/points`, race_date: "2026-09-13" },
        { race_slug: `${gt}/points`, race_date: "2026-09-13" },
        { race_slug: `${gt}/kom`, race_date: "2026-09-13" },
        { race_slug: `${gt}/youth`, race_date: "2026-09-13" },
      ],
      rider_xp_daily: [
        { race_slug: `${gt}/stage-21`, team_id: "T1", rider_id: "r1", xp_gained: 100 },
        { race_slug: `${gt}/gc`, team_id: "T1", rider_id: "r1", xp_gained: 400 },
        { race_slug: `${gt}/points`, team_id: "T1", rider_id: "r2", xp_gained: 150 },
        { race_slug: `${gt}/kom`, team_id: "T1", rider_id: "r1", xp_gained: 150 },
        { race_slug: `${gt}/youth`, team_id: "T1", rider_id: "r3", xp_gained: 75 },
      ],
      teams: [{ id: "T1", name: "Mon \u00e9quipe" }],
      riders: [
        { id: "r1", full_name: "Santiago Buitrago" },
        { id: "r2", full_name: "Wout Van Aert" },
        { id: "r3", full_name: "Oscar Onley" },
      ],
      sponsor_bonuses: [],
      gt_tactic_activations: [],
      auctions: [],
    });

    const result = await getRaceFeedData(supabase, {
      leagueId: "L1",
      myTeamId: "T1",
      referenceDate: new Date("2026-09-14T08:00:00Z"),
    });

    const group = result.groups.find((g) => g.date === "2026-09-13")!;
    expect(group).toBeDefined();
    const slugs = group.cards.map((c) =>
      c.type === "past" || c.type === "today" ? c.race.raceSlug : ""
    );
    expect(slugs).toEqual([
      `${gt}/stage-21`,
      `${gt}/gc`,
      `${gt}/points`,
      `${gt}/kom`,
      `${gt}/youth`,
    ]);

    const titles = group.cards.map((c) =>
      c.type === "past" || c.type === "today" ? c.race.raceTitle : ""
    );
    expect(titles).toEqual([
      "Vuelta \u00b7 Stage 21",
      "Vuelta \u00b7 Final GC",
      "Vuelta \u00b7 Points",
      "Vuelta \u00b7 KOM",
      "Vuelta \u00b7 Youth",
    ]);

    const komCard = group.cards.find(
      (c) => (c.type === "past" || c.type === "today") && c.race.raceSlug === `${gt}/kom`
    )!;
    if (komCard.type !== "past" && komCard.type !== "today") return;
    expect(komCard.race.teams[0]?.totalXp).toBe(150);
    expect(komCard.race.teams[0]?.riders[0]?.riderShortName).toBe("S. Buitrago");
  });

  it("hides a jersey card when no rider of the league scored on it", async () => {
    // Realistic for the KOM: a jersey nobody in the league held pays nothing, and an
    // empty card would say nothing. A stage with no XP yet must still be shown.
    const gt = "race/vuelta-a-espana/2026";
    const supabase = buildSupabase({
      race_results: [
        { race_slug: `${gt}/stage-21`, race_name: "La Vuelta \u2014 Stage 21", race_date: "2026-09-13" },
      ],
      race_startlists: [],
      gt_final_classifications: [
        { race_slug: `${gt}/points`, race_date: "2026-09-13" },
        { race_slug: `${gt}/kom`, race_date: "2026-09-13" },
      ],
      rider_xp_daily: [
        { race_slug: `${gt}/points`, team_id: "T1", rider_id: "r1", xp_gained: 150 },
      ],
      teams: [{ id: "T1", name: "Mon \u00e9quipe" }],
      riders: [{ id: "r1", full_name: "Wout Van Aert" }],
      sponsor_bonuses: [],
      gt_tactic_activations: [],
      auctions: [],
    });

    const result = await getRaceFeedData(supabase, {
      leagueId: "L1",
      myTeamId: "T1",
      referenceDate: new Date("2026-09-14T08:00:00Z"),
    });

    const group = result.groups.find((g) => g.date === "2026-09-13")!;
    const slugs = group.cards.map((c) =>
      c.type === "past" || c.type === "today" ? c.race.raceSlug : ""
    );
    expect(slugs).toContain(`${gt}/points`);
    expect(slugs).not.toContain(`${gt}/kom`);
    expect(slugs).toContain(`${gt}/stage-21`);
  });

  it("falls back to the GC card's date when race_date is null on the jersey rows", async () => {
    const gt = "race/vuelta-a-espana/2026";
    const supabase = buildSupabase({
      race_results: [
        {
          race_slug: `${gt}/gc`,
          race_name: "La Vuelta Ciclista a Espa\u00f1a \u2014 Stage 21 - GC",
          race_date: "2026-09-13",
        },
      ],
      race_startlists: [],
      gt_final_classifications: [{ race_slug: `${gt}/points`, race_date: null }],
      rider_xp_daily: [
        { race_slug: `${gt}/points`, team_id: "T1", rider_id: "r1", xp_gained: 150 },
      ],
      teams: [{ id: "T1", name: "Mon \u00e9quipe" }],
      riders: [{ id: "r1", full_name: "Wout Van Aert" }],
      sponsor_bonuses: [],
      gt_tactic_activations: [],
      auctions: [],
    });

    const result = await getRaceFeedData(supabase, {
      leagueId: "L1",
      myTeamId: "T1",
      referenceDate: new Date("2026-09-14T08:00:00Z"),
    });

    const group = result.groups.find((g) => g.date === "2026-09-13")!;
    const slugs = group.cards.map((c) =>
      c.type === "past" || c.type === "today" ? c.race.raceSlug : ""
    );
    expect(slugs).toContain(`${gt}/points`);
  });
});
