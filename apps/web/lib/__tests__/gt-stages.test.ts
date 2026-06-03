import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { installSequence, makeChain } from "@/test-utils/supabase-mock";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

import { getGtStages } from "../gt-stages";

const TEAM_ID = "550e8400-e29b-41d4-a716-446655440099";

function makeSupabase(fromImpl: ReturnType<typeof vi.fn>) {
  return { from: fromImpl } as unknown as SupabaseClient<Database>;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Mode GT (phaseId + year)
// ---------------------------------------------------------------------------

describe("getGtStages — GT mode", () => {
  it("returns upcoming Giro stages from GT_SCHEDULES, past stages filtered out", async () => {
    // 2026-05-20: Giro stages 1-11 are past (1-9 through 5/17, rest day 5/18, 10 = 5/19, 11 = 5/20=today).
    vi.setSystemTime(new Date("2026-05-20T08:00:00Z")); // 09:00 CET — before 11:00 cutoff

    const mockFrom = vi.fn();
    installSequence(mockFrom, [
      { table: "gt_tactic_activations", data: [] },
      { table: "stage_profiles", data: [] },
    ]);

    const stages = await getGtStages(makeSupabase(mockFrom), {
      teamId: TEAM_ID,
      phaseId: 4,
      year: 2026,
    });

    // 10 upcoming stages remain (today = stage 11 on 2026-05-20, plus 12..21).
    const numbers = stages.map((s) => s.number);
    expect(numbers).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);

    // Today stage (#11) is annotated with cutoff-not-yet-passed.
    const today = stages.find((s) => s.status === "today")!;
    expect(today.number).toBe(11);
    expect(today.isTodayCutoffPassed).toBe(false);

    // Slug shape uses the GT canonical prefix.
    expect(stages[0].slug).toBe("race/giro-d-italia/2026/stage-11");
  });

  it("flips isTodayCutoffPassed=true after 11:00 CET", async () => {
    vi.setSystemTime(new Date("2026-05-20T10:00:00Z")); // 12:00 CET — past cutoff

    const mockFrom = vi.fn();
    installSequence(mockFrom, [
      { table: "gt_tactic_activations", data: [] },
      { table: "stage_profiles", data: [] },
    ]);

    const stages = await getGtStages(makeSupabase(mockFrom), {
      teamId: TEAM_ID,
      phaseId: 4,
      year: 2026,
    });

    const today = stages.find((s) => s.status === "today")!;
    expect(today.isTodayCutoffPassed).toBe(true);
  });

  it("annotates hasTacticActive when gt_tactic_activations matches a stage slug", async () => {
    vi.setSystemTime(new Date("2026-05-15T08:00:00Z"));

    const mockFrom = vi.fn();
    installSequence(mockFrom, [
      {
        table: "gt_tactic_activations",
        data: [
          { stage_slug: "race/giro-d-italia/2026/stage-15" },
          { stage_slug: "race/giro-d-italia/2026/stage-18" },
        ],
      },
      { table: "stage_profiles", data: [] },
    ]);

    const stages = await getGtStages(makeSupabase(mockFrom), {
      teamId: TEAM_ID,
      phaseId: 4,
      year: 2026,
    });

    const s15 = stages.find((s) => s.number === 15)!;
    const s18 = stages.find((s) => s.number === 18)!;
    const s16 = stages.find((s) => s.number === 16)!;
    expect(s15.hasTacticActive).toBe(true);
    expect(s18.hasTacticActive).toBe(true);
    expect(s16.hasTacticActive).toBeUndefined();
  });

  it("annotates profileIcon from stage_profiles bulk read", async () => {
    vi.setSystemTime(new Date("2026-05-15T08:00:00Z"));

    const mockFrom = vi.fn();
    installSequence(mockFrom, [
      { table: "gt_tactic_activations", data: [] },
      {
        table: "stage_profiles",
        data: [
          { race_slug: "race/giro-d-italia/2026/stage-15", profile_icon: "p1" },
          { race_slug: "race/giro-d-italia/2026/stage-16", profile_icon: "p5" },
        ],
      },
    ]);

    const stages = await getGtStages(makeSupabase(mockFrom), {
      teamId: TEAM_ID,
      phaseId: 4,
      year: 2026,
    });

    const s15 = stages.find((s) => s.number === 15)!;
    const s16 = stages.find((s) => s.number === 16)!;
    const s17 = stages.find((s) => s.number === 17)!;
    expect(s15.profileIcon).toBe("p1");
    expect(s16.profileIcon).toBe("p5");
    expect(s17.profileIcon).toBeNull(); // no row → stays null
  });

  it("returns empty when GT phase has no schedule entry", async () => {
    vi.setSystemTime(new Date("2026-07-01T08:00:00Z"));

    const mockFrom = vi.fn();
    // No supabase calls expected when buildGtStages returns []
    mockFrom.mockImplementation(() => {
      throw new Error("from() should not be called when schedule is empty");
    });

    // phaseId=8 (Vuelta) not in GT_SCHEDULES → []
    const stages = await getGtStages(makeSupabase(mockFrom), {
      teamId: TEAM_ID,
      phaseId: 8,
      year: 2026,
    });

    expect(stages).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Mode 1-week (raceSlug)
// ---------------------------------------------------------------------------

describe("getGtStages — 1-week mode", () => {
  it("builds 8 Dauphiné stages from stage_profiles, sorted by number, with profile and date", async () => {
    vi.setSystemTime(new Date("2026-06-05T08:00:00Z")); // 2 days before Dauphiné starts

    const dauphineRows = [
      { race_slug: "race/dauphine/2026/stage-1", race_date: "2026-06-07", profile_icon: "p3" },
      { race_slug: "race/dauphine/2026/stage-2", race_date: "2026-06-08", profile_icon: "p2" },
      { race_slug: "race/dauphine/2026/stage-3", race_date: "2026-06-09", profile_icon: "p3" },
      { race_slug: "race/dauphine/2026/stage-4", race_date: "2026-06-10", profile_icon: "p2" },
      { race_slug: "race/dauphine/2026/stage-5", race_date: "2026-06-11", profile_icon: "p1" },
      { race_slug: "race/dauphine/2026/stage-6", race_date: "2026-06-12", profile_icon: "p5" },
      { race_slug: "race/dauphine/2026/stage-7", race_date: "2026-06-13", profile_icon: "p5" },
      { race_slug: "race/dauphine/2026/stage-8", race_date: "2026-06-14", profile_icon: "p5" },
    ];

    const mockFrom = vi.fn();
    installSequence(mockFrom, [
      { table: "stage_profiles", data: dauphineRows },
      { table: "gt_tactic_activations", data: [] },
      // No second stage_profiles call expected: profileIcon already filled.
    ]);

    const stages = await getGtStages(makeSupabase(mockFrom), {
      teamId: TEAM_ID,
      raceSlug: "race/dauphine/2026",
    });

    expect(stages).toHaveLength(8);
    expect(stages.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(stages[0].slug).toBe("race/dauphine/2026/stage-1");
    expect(stages[0].date).toBe("2026-06-07");
    expect(stages[0].profileIcon).toBe("p3");
    expect(stages[2].profileIcon).toBe("p3");
    expect(stages[7].profileIcon).toBe("p5");
    expect(stages.every((s) => s.status === "upcoming")).toBe(true);
  });

  it("annotates hasTacticActive for 1-week stages via the race_slug filter", async () => {
    vi.setSystemTime(new Date("2026-06-05T08:00:00Z"));

    const mockFrom = vi.fn();
    installSequence(mockFrom, [
      {
        table: "stage_profiles",
        data: [
          { race_slug: "race/dauphine/2026/stage-1", race_date: "2026-06-07", profile_icon: "p3" },
          { race_slug: "race/dauphine/2026/stage-2", race_date: "2026-06-08", profile_icon: "p2" },
        ],
      },
      {
        table: "gt_tactic_activations",
        data: [{ stage_slug: "race/dauphine/2026/stage-2" }],
      },
    ]);

    const stages = await getGtStages(makeSupabase(mockFrom), {
      teamId: TEAM_ID,
      raceSlug: "race/dauphine/2026",
    });

    expect(stages.find((s) => s.number === 1)?.hasTacticActive).toBeUndefined();
    expect(stages.find((s) => s.number === 2)?.hasTacticActive).toBe(true);
  });

  it("filters past stages out of the result", async () => {
    vi.setSystemTime(new Date("2026-06-10T08:00:00Z")); // mid-Dauphiné

    const mockFrom = vi.fn();
    installSequence(mockFrom, [
      {
        table: "stage_profiles",
        data: [
          { race_slug: "race/dauphine/2026/stage-1", race_date: "2026-06-07", profile_icon: "p3" },
          { race_slug: "race/dauphine/2026/stage-2", race_date: "2026-06-08", profile_icon: "p2" },
          { race_slug: "race/dauphine/2026/stage-3", race_date: "2026-06-09", profile_icon: "p3" },
          { race_slug: "race/dauphine/2026/stage-4", race_date: "2026-06-10", profile_icon: "p2" },
          { race_slug: "race/dauphine/2026/stage-5", race_date: "2026-06-11", profile_icon: "p1" },
        ],
      },
      { table: "gt_tactic_activations", data: [] },
    ]);

    const stages = await getGtStages(makeSupabase(mockFrom), {
      teamId: TEAM_ID,
      raceSlug: "race/dauphine/2026",
    });

    // Stages 1-3 are past; 4 is today; 5 is upcoming.
    expect(stages.map((s) => s.number)).toEqual([4, 5]);
    expect(stages[0].status).toBe("today");
    expect(stages[1].status).toBe("upcoming");
  });

  it("returns empty when stage_profiles has no rows for the slug", async () => {
    vi.setSystemTime(new Date("2026-06-05T08:00:00Z"));

    const mockFrom = vi.fn();
    mockFrom.mockReturnValueOnce(makeChain([])); // stage_profiles → []
    // Early-return after buildOneWeekStages — no further from() calls.

    const stages = await getGtStages(makeSupabase(mockFrom), {
      teamId: TEAM_ID,
      raceSlug: "race/unknown-race/2026",
    });

    expect(stages).toEqual([]);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("skips rows with missing race_date (defensive against malformed seed data)", async () => {
    vi.setSystemTime(new Date("2026-06-05T08:00:00Z"));

    const mockFrom = vi.fn();
    installSequence(mockFrom, [
      {
        table: "stage_profiles",
        data: [
          { race_slug: "race/dauphine/2026/stage-1", race_date: "2026-06-07", profile_icon: "p3" },
          { race_slug: "race/dauphine/2026/stage-2", race_date: null, profile_icon: "p2" }, // skipped
        ],
      },
      { table: "gt_tactic_activations", data: [] },
    ]);

    const stages = await getGtStages(makeSupabase(mockFrom), {
      teamId: TEAM_ID,
      raceSlug: "race/dauphine/2026",
    });

    expect(stages).toHaveLength(1);
    expect(stages[0].number).toBe(1);
  });
});
