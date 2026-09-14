import { describe, it, expect } from "vitest";
import {
  computeCareer,
  computeHeadToHead,
  computeJerseys,
  computeSeasonRanks,
  computeWins,
} from "./aggregate";
import type { PalmaresEvent, Player, SeasonRankingEntry, SeasonStanding } from "./types";

const anna: Player = { key: "Anna", displayName: "Anna", isFormerPlayer: false };
const ben: Player = { key: "Ben", displayName: "Ben", isFormerPlayer: false };
const gone: Player = { key: "Gone", displayName: "Gone", isFormerPlayer: true };

/** A season standing in finishing order. The scores only have to decrease. */
function ranked(...order: Player[]): SeasonRankingEntry[] {
  return order.map((player, i) => ({ ...player, score: (order.length - i) * 100 }));
}

function event(
  seasonYear: number,
  eventType: PalmaresEvent["eventType"],
  order: Player[],
  extra: Partial<PalmaresEvent> = {},
): PalmaresEvent {
  return {
    seasonYear,
    eventType,
    status: "played",
    standings: order.map((p, i) => ({ ...p, rank: i + 1 })),
    jerseys: {},
    ...extra,
  };
}

describe("computeWins", () => {
  const events = [
    event(2019, "tour-de-france", [gone, anna, ben]),
    event(2019, "giro", [anna, ben]),
    event(2020, "giro", [ben, anna]),
  ];

  it("counts a win as a first place, per event type", () => {
    const rows = computeWins(events);
    const annaRow = rows.find((r) => r.key === "Anna")!;
    expect(annaRow.wins).toBe(1);
    expect(annaRow.winsByEvent.giro).toBe(1);
    expect(annaRow.winsByEvent["tour-de-france"]).toBe(0);
  });

  it("keeps a former player, whose win the totals depend on", () => {
    const rows = computeWins(events);
    const goneRow = rows.find((r) => r.key === "Gone");
    expect(goneRow?.wins).toBe(1);
    expect(goneRow?.isFormerPlayer).toBe(true);
    // Dropping him would leave one Tour played and no winner listed.
    const tourWins = rows.reduce((sum, r) => sum + r.winsByEvent["tour-de-france"], 0);
    expect(tourWins).toBe(1);
  });

  it("counts starts and podium places with no participation threshold", () => {
    const rows = computeWins(events);
    expect(rows.find((r) => r.key === "Anna")!.starts).toBe(3);
    expect(rows.find((r) => r.key === "Gone")!.starts).toBe(1);
    // 2nd of the Tour, 1st of the 2019 Giro, 2nd of the 2020 Giro.
    expect(rows.find((r) => r.key === "Anna")!.podium).toEqual([1, 2, 0]);
  });

  it("ignores an event that was not played", () => {
    const rows = computeWins([
      ...events,
      { seasonYear: 2021, eventType: "vuelta", status: "upcoming", standings: [], jerseys: {} },
    ]);
    expect(rows.find((r) => r.key === "Anna")!.starts).toBe(3);
  });
});

describe("computeJerseys", () => {
  it("counts one title per jersey per event", () => {
    const rows = computeJerseys([
      event(2020, "giro", [anna, ben], { jerseys: { yel: anna, grn: ben, pol: anna, wht: ben } }),
      event(2020, "tour-de-france", [ben, anna], { jerseys: { yel: ben } }),
    ]);
    const annaRow = rows.find((r) => r.key === "Anna")!;
    expect(annaRow.byJersey).toEqual({ yel: 1, grn: 0, pol: 1, wht: 0 });
    expect(annaRow.total).toBe(2);
    expect(rows.find((r) => r.key === "Ben")!.total).toBe(3);
  });

  it("gives the Classics no jersey at all", () => {
    const rows = computeJerseys([event(2020, "classics", [anna, ben])]);
    expect(rows).toEqual([]);
  });
});

describe("computeHeadToHead", () => {
  const events = [
    event(2019, "giro", [anna, ben]),
    event(2020, "giro", [ben, anna]),
    event(2021, "giro", [anna, ben]),
    // Ben skipped this one: it must not count for either of them.
    event(2022, "giro", [anna, gone]),
  ];

  it("only counts the events both players entered", () => {
    const rows = computeHeadToHead(events, "Anna");
    const vsBen = rows.find((r) => r.key === "Ben")!;
    expect(vsBen.shared).toBe(3);
    expect(vsBen.ahead).toBe(2);
    expect(vsBen.behind).toBe(1);

    const vsGone = rows.find((r) => r.key === "Gone")!;
    expect(vsGone.shared).toBe(1);
  });

  it("sorts most favourable first", () => {
    expect(computeHeadToHead(events, "Anna").map((r) => r.key)).toEqual(["Gone", "Ben"]);
  });

  it("never lets a 1-0 outrank a long winning record", () => {
    const rows = computeHeadToHead(
      [
        event(2019, "giro", [anna, ben]),
        event(2020, "giro", [anna, ben]),
        event(2021, "giro", [anna, gone]),
      ],
      "Anna",
    );
    // Both are at 100%, the one with more shared races comes first.
    expect(rows.map((r) => r.key)).toEqual(["Ben", "Gone"]);
  });
});

describe("computeSeasonRanks", () => {
  const standings: SeasonStanding[] = [
    { seasonYear: 2020, source: "archive", isCurrent: false, note: null, ranking: ranked(ben, anna) },
    { seasonYear: 2019, source: "archive", isCurrent: false, note: null, ranking: ranked(anna, ben, gone) },
  ];

  it("returns the rank and the size of the field, oldest first", () => {
    expect(computeSeasonRanks(standings, "Anna")).toEqual([
      { seasonYear: 2019, rank: 1, fieldSize: 3 },
      { seasonYear: 2020, rank: 2, fieldSize: 2 },
    ]);
  });

  it("skips a season the player did not play", () => {
    expect(computeSeasonRanks(standings, "Gone")).toEqual([
      { seasonYear: 2019, rank: 3, fieldSize: 3 },
    ]);
  });
});

describe("computeCareer", () => {
  it("counts a season title as a first place in the season standing", () => {
    const events = [
      event(2019, "giro", [anna, ben], { jerseys: { yel: anna } }),
      event(2020, "giro", [ben, anna]),
    ];
    const standings: SeasonStanding[] = [
      { seasonYear: 2020, source: "archive", isCurrent: false, note: null, ranking: ranked(ben, anna) },
      { seasonYear: 2019, source: "archive", isCurrent: false, note: null, ranking: ranked(anna, ben) },
    ];
    const career = computeCareer(events, standings, "Anna")!;
    expect(career.starts).toBe(2);
    expect(career.totalEvents).toBe(2);
    expect(career.seasonsPlayed).toBe(2);
    expect(career.wins).toBe(1);
    expect(career.seasonTitles).toBe(1);
    expect(career.podium).toEqual([1, 1, 0]);
    expect(career.jerseys).toBe(1);
  });

  it("returns null for someone who never started", () => {
    expect(computeCareer([event(2019, "giro", [anna])], [], "Ben")).toBeNull();
  });
});

describe("computeCareer — season titles", () => {
  const events = [event(2026, "giro", [anna, ben])];

  it("never credits a title for a season still being played", () => {
    const standings: SeasonStanding[] = [
      { seasonYear: 2026, source: "watthunter", isCurrent: true, note: null, ranking: ranked(anna, ben) },
    ];
    // Anna leads 2026. Leading is not winning.
    expect(computeCareer(events, standings, "Anna")!.seasonTitles).toBe(0);
  });

  it("credits it once the season is over", () => {
    const standings: SeasonStanding[] = [
      { seasonYear: 2026, source: "watthunter", isCurrent: false, note: null, ranking: ranked(anna, ben) },
    ];
    expect(computeCareer(events, standings, "Anna")!.seasonTitles).toBe(1);
  });
});
