import { describe, it, expect } from "vitest";
import { resolveEventStatus } from "./status";

const CLASSICS_WINDOW_2026 = { start: "2026-02-01", end: "2026-10-10" };
const VUELTA_WINDOW_2026 = { start: "2026-08-22", end: "2026-09-13" };

function played(keys: string[]) {
  return new Set(keys);
}

describe("resolveEventStatus", () => {
  it("closes the classics once the calendar runs on without the league", () => {
    // The real 2026 case: the league stopped at Liège on 04-26, the calendar has
    // since run the GP de Montréal. Without this rule the group stayed "ongoing"
    // until Il Lombardia in October and showed no podium.
    expect(
      resolveEventStatus({
        hasResults: true,
        window: CLASSICS_WINDOW_2026,
        lastFinishedRaceKey: "gp-montreal",
        playedRaceKeys: played(["milano-sanremo", "paris-roubaix", "liege-bastogne-liege"]),
        today: "2026-09-15",
      }),
    ).toBe("played");
  });

  it("keeps a group open while the league is still playing it", () => {
    expect(
      resolveEventStatus({
        hasResults: true,
        window: CLASSICS_WINDOW_2026,
        lastFinishedRaceKey: "ronde-van-vlaanderen",
        playedRaceKeys: played(["milano-sanremo", "ronde-van-vlaanderen"]),
        today: "2026-04-06",
      }),
    ).toBe("ongoing");
  });

  it("closes a Grand Tour on its window alone", () => {
    // A GT is one event with a real end date: the window clause is enough, and
    // `lastFinishedRaceKey` agreeing or not never comes into play.
    expect(
      resolveEventStatus({
        hasResults: true,
        window: VUELTA_WINDOW_2026,
        lastFinishedRaceKey: "vuelta-a-espana",
        playedRaceKeys: played(["vuelta-a-espana"]),
        today: "2026-09-15",
      }),
    ).toBe("played");
  });

  it("keeps a Grand Tour open while it is running", () => {
    expect(
      resolveEventStatus({
        hasResults: true,
        window: VUELTA_WINDOW_2026,
        lastFinishedRaceKey: null,
        playedRaceKeys: played(["vuelta-a-espana"]),
        today: "2026-09-01",
      }),
    ).toBe("ongoing");
  });

  it("flips to played when a classic is skipped mid-season, then back", () => {
    // Known limitation, written down rather than discovered: the rule reads what
    // was played, so a hole in the middle looks like the end until the next race
    // fills it in. Acceptable because a league stops at the tail, it does not
    // resume after skipping one.
    const skippedFleche = {
      hasResults: true,
      window: CLASSICS_WINDOW_2026,
      playedRaceKeys: played(["paris-roubaix", "amstel-gold-race", "liege-bastogne-liege"]),
    };
    expect(
      resolveEventStatus({ ...skippedFleche, lastFinishedRaceKey: "la-fleche-wallonne", today: "2026-04-23" }),
    ).toBe("played");
    expect(
      resolveEventStatus({ ...skippedFleche, lastFinishedRaceKey: "liege-bastogne-liege", today: "2026-04-27" }),
    ).toBe("ongoing");
  });

  it("never invents a result: no XP means upcoming or not played", () => {
    const noResults = { hasResults: false, lastFinishedRaceKey: null, playedRaceKeys: played([]) };
    expect(resolveEventStatus({ ...noResults, window: VUELTA_WINDOW_2026, today: "2026-01-01" })).toBe("upcoming");
    expect(resolveEventStatus({ ...noResults, window: VUELTA_WINDOW_2026, today: "2026-09-15" })).toBe("not-played");
    expect(resolveEventStatus({ ...noResults, window: null, today: "2026-09-15" })).toBe("not-played");
  });
});
