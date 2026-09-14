import { describe, it, expect } from "vitest";
import {
  buildRaceGroups,
  getRaceGroupId,
  getWtRaceType,
  isOneDayRace,
  isStageRace,
  resolveRaceGroupParam,
} from "./race-groups";

describe("getWtRaceType", () => {
  it("reads the type of a one-day race from the World Tour calendar", () => {
    expect(getWtRaceType("race/paris-roubaix/2026")).toBe("one-day");
  });

  it("reads the type of a stage race from the World Tour calendar", () => {
    expect(getWtRaceType("race/giro-d-italia/2026")).toBe("stage-race");
  });

  it("resolves a stage slug to the type of its parent race", () => {
    expect(getWtRaceType("race/tour-de-france/2026/stage-14")).toBe("stage-race");
  });

  it("resolves a final classification slug to the type of its parent race", () => {
    // `.../gc` has no stage number: reading `stage IS NULL` would call it a one-day race.
    expect(getWtRaceType("race/paris-nice/2026/gc")).toBe("stage-race");
    expect(isOneDayRace("race/paris-nice/2026/gc")).toBe(false);
    expect(isStageRace("race/paris-nice/2026/gc")).toBe(true);
  });

  it("is year-agnostic", () => {
    expect(getWtRaceType("race/paris-roubaix/2019")).toBe("one-day");
    expect(getWtRaceType("race/tour-de-france/2017/stage-3")).toBe("stage-race");
  });

  it("returns null for a race outside the World Tour calendar", () => {
    expect(getWtRaceType("race/some-local-crit/2026")).toBeNull();
  });
});

describe("getRaceGroupId", () => {
  it("puts each grand tour in its own group", () => {
    expect(getRaceGroupId("race/giro-d-italia/2026/stage-3")).toBe("giro");
    expect(getRaceGroupId("race/tour-de-france/2026/gc")).toBe("tour-de-france");
    expect(getRaceGroupId("race/vuelta-a-espana/2026/stage-21")).toBe("vuelta");
  });

  it("puts every one-day race in Classics, whichever auction phase it falls in", () => {
    // Classics Part 1 and Classics Part 2 are two auction phases, one group.
    expect(getRaceGroupId("race/milano-sanremo/2026")).toBe("classics");
    expect(getRaceGroupId("race/liege-bastogne-liege/2026")).toBe("classics");
    // Even a late-season one-day race.
    expect(getRaceGroupId("race/il-lombardia/2026")).toBe("classics");
  });

  it("leaves one-week stage races out of every group", () => {
    expect(getRaceGroupId("race/paris-nice/2026/stage-3")).toBeNull();
    expect(getRaceGroupId("race/tirreno-adriatico/2026")).toBeNull();
    expect(getRaceGroupId("race/dauphine/2026/gc")).toBeNull();
    expect(getRaceGroupId("race/tour-de-suisse/2026")).toBeNull();
  });
});

describe("buildRaceGroups", () => {
  it("returns the four groups in a fixed order with their child slugs", () => {
    const groups = buildRaceGroups([
      "race/vuelta-a-espana/2026/stage-1",
      "race/milano-sanremo/2026",
      "race/giro-d-italia/2026/stage-7",
      "race/paris-roubaix/2026",
      "race/tour-de-france/2026/gc",
    ]);

    expect(groups.map((g) => g.slug)).toEqual([
      "classics",
      "giro",
      "tour-de-france",
      "vuelta",
    ]);
    expect(groups.map((g) => g.name)).toEqual([
      "Classics",
      "Giro",
      "Tour de France",
      "Vuelta",
    ]);
    expect(groups[0].childSlugs).toEqual([
      "race/milano-sanremo/2026",
      "race/paris-roubaix/2026",
    ]);
  });

  it("drops one-week races and empty groups", () => {
    const groups = buildRaceGroups([
      "race/paris-nice/2026/stage-2",
      "race/dauphine/2026/gc",
      "race/giro-d-italia/2026/stage-7",
    ]);

    expect(groups.map((g) => g.slug)).toEqual(["giro"]);
    expect(groups[0].childSlugs).toEqual(["race/giro-d-italia/2026/stage-7"]);
  });

  it("does not duplicate a slug seen twice", () => {
    const groups = buildRaceGroups([
      "race/paris-roubaix/2026",
      "race/paris-roubaix/2026",
    ]);
    expect(groups[0].childSlugs).toEqual(["race/paris-roubaix/2026"]);
  });
});

describe("resolveRaceGroupParam", () => {
  it("accepts a group id", () => {
    expect(resolveRaceGroupParam("giro")).toBe("giro");
  });

  it("accepts the race slug the feed cards already link to", () => {
    expect(resolveRaceGroupParam("race/giro-d-italia/2026")).toBe("giro");
    expect(resolveRaceGroupParam("race/paris-roubaix/2026")).toBe("classics");
  });

  it("falls back to All races for a one-week race or an empty param", () => {
    expect(resolveRaceGroupParam("race/paris-nice/2026")).toBeNull();
    expect(resolveRaceGroupParam(null)).toBeNull();
    expect(resolveRaceGroupParam(undefined)).toBeNull();
  });
});
