import { describe, it, expect } from "vitest";
import {
  detectRaceType,
  getParentRaceSlug,
  getParentRaceLabel,
  formatRaceTitle,
  getFinalClassificationType,
  isSecondaryFinalSlug,
  finalCardSortRank,
  baseRaceName,
  shortenRiderName,
  formatBonusEur,
  formatRaceDateLabel,
} from "../race-feed-helpers";

describe("detectRaceType", () => {
  it("returns 'stage' for slugs ending in /stage-N", () => {
    expect(detectRaceType("race/giro-d-italia/2026/stage-3")).toBe("stage");
    expect(detectRaceType("race/tour-de-france/2026/stage-21")).toBe("stage");
  });

  it("returns 'classic' for slugs without stage suffix", () => {
    expect(detectRaceType("race/paris-roubaix/2026")).toBe("classic");
    expect(detectRaceType("race/liege-bastogne-liege/2026")).toBe("classic");
  });

  it("treats /gc and /results suffixes as classic for V1", () => {
    expect(detectRaceType("race/tour-romandie/2026/gc/results")).toBe("classic");
  });
});

describe("getParentRaceSlug", () => {
  it("returns the parent slug for a stage", () => {
    expect(getParentRaceSlug("race/giro-d-italia/2026/stage-3")).toBe(
      "race/giro-d-italia/2026"
    );
  });

  it("returns null for a classic", () => {
    expect(getParentRaceSlug("race/paris-roubaix/2026")).toBeNull();
  });

  it("returns the parent slug for the GC final classification", () => {
    expect(getParentRaceSlug("race/giro-d-italia/2026/gc")).toBe(
      "race/giro-d-italia/2026"
    );
    expect(getParentRaceSlug("race/tour-de-france/2026/gc")).toBe(
      "race/tour-de-france/2026"
    );
  });

  it("returns the parent slug for GT secondary final jerseys", () => {
    expect(getParentRaceSlug("race/giro-d-italia/2026/points")).toBe(
      "race/giro-d-italia/2026"
    );
    expect(getParentRaceSlug("race/giro-d-italia/2026/kom")).toBe(
      "race/giro-d-italia/2026"
    );
    expect(getParentRaceSlug("race/giro-d-italia/2026/youth")).toBe(
      "race/giro-d-italia/2026"
    );
  });

  it("ignores unrelated trailing segments", () => {
    expect(getParentRaceSlug("race/giro-d-italia/2026/teams")).toBeNull();
    expect(getParentRaceSlug("race/giro-d-italia/2026/stage-abc")).toBeNull();
  });
});

describe("getParentRaceLabel", () => {
  it("returns short label for known GTs", () => {
    expect(getParentRaceLabel("race/giro-d-italia/2026")).toBe("Giro");
    expect(getParentRaceLabel("race/tour-de-france/2026")).toBe("Tour");
    expect(getParentRaceLabel("race/vuelta-a-espana/2026")).toBe("Vuelta");
  });

  it("returns null for unknown parents", () => {
    expect(getParentRaceLabel("race/some-week-race/2026")).toBeNull();
  });
});

describe("formatRaceTitle", () => {
  it("formats a stage title as '<ParentLabel> · Stage N'", () => {
    expect(
      formatRaceTitle({
        raceType: "stage",
        raceName: "Giro d'Italia - Stage 2",
        raceSlug: "race/giro-d-italia/2026/stage-2",
        parentRaceLabel: "Giro",
      })
    ).toBe("Giro · Stage 2");
  });

  it("falls back to raceName for classics", () => {
    expect(
      formatRaceTitle({
        raceType: "classic",
        raceName: "Paris-Roubaix",
        raceSlug: "race/paris-roubaix/2026",
        parentRaceLabel: null,
      })
    ).toBe("Paris-Roubaix");
  });

  it("names the four final classifications as a family", () => {
    const title = (slug: string, raceName: string) =>
      formatRaceTitle({
        raceType: "classic",
        raceName,
        raceSlug: slug,
        parentRaceLabel: "Vuelta",
      });
    // The GC row's race_name drags the last stage it was imported with — the title
    // must not show "Stage 21".
    expect(
      title("race/vuelta-a-espana/2026/gc", "La Vuelta Ciclista a Espa\u00f1a \u2014 Stage 21 - GC")
    ).toBe("Vuelta \u00b7 Final GC");
    expect(title("race/vuelta-a-espana/2026/points", "Vuelta - Points")).toBe("Vuelta \u00b7 Points");
    expect(title("race/vuelta-a-espana/2026/kom", "Vuelta - KOM")).toBe("Vuelta \u00b7 KOM");
    expect(title("race/vuelta-a-espana/2026/youth", "Vuelta - Youth")).toBe("Vuelta \u00b7 Youth");
  });

  it("falls back to the base race name when the parent has no short label", () => {
    expect(
      formatRaceTitle({
        raceType: "classic",
        raceName: "Tour de Romandie \u2014 Stage 5 - GC",
        raceSlug: "race/tour-de-romandie/2026/gc",
        parentRaceLabel: null,
      })
    ).toBe("Tour de Romandie \u00b7 Final GC");
  });
});

describe("final classification helpers", () => {
  it("detects the four final suffixes and only those", () => {
    expect(getFinalClassificationType("race/vuelta-a-espana/2026/gc")).toBe("gc");
    expect(getFinalClassificationType("race/vuelta-a-espana/2026/points")).toBe("points");
    expect(getFinalClassificationType("race/vuelta-a-espana/2026/kom")).toBe("kom");
    expect(getFinalClassificationType("race/vuelta-a-espana/2026/youth")).toBe("youth");
    expect(getFinalClassificationType("race/vuelta-a-espana/2026/stage-21")).toBeNull();
    expect(getFinalClassificationType("race/paris-roubaix/2026")).toBeNull();
  });

  it("treats only the three jerseys as secondary finals (GC lives in race_results)", () => {
    expect(isSecondaryFinalSlug("race/vuelta-a-espana/2026/gc")).toBe(false);
    expect(isSecondaryFinalSlug("race/vuelta-a-espana/2026/points")).toBe(true);
    expect(isSecondaryFinalSlug("race/vuelta-a-espana/2026/stage-21")).toBe(false);
  });

  it("ranks a date group as stage \u2192 GC \u2192 Points \u2192 KOM \u2192 Youth", () => {
    const slugs = [
      "race/vuelta-a-espana/2026/youth",
      "race/vuelta-a-espana/2026/gc",
      "race/vuelta-a-espana/2026/stage-21",
      "race/vuelta-a-espana/2026/kom",
      "race/vuelta-a-espana/2026/points",
    ];
    expect([...slugs].sort((a, b) => finalCardSortRank(a) - finalCardSortRank(b))).toEqual([
      "race/vuelta-a-espana/2026/stage-21",
      "race/vuelta-a-espana/2026/gc",
      "race/vuelta-a-espana/2026/points",
      "race/vuelta-a-espana/2026/kom",
      "race/vuelta-a-espana/2026/youth",
    ]);
  });

  it("strips the stage tail from a race name, em dash or hyphen", () => {
    expect(baseRaceName("La Vuelta Ciclista a Espa\u00f1a \u2014 Stage 21 - GC")).toBe(
      "La Vuelta Ciclista a Espa\u00f1a"
    );
    expect(baseRaceName("Giro d'Italia - Stage 2")).toBe("Giro d'Italia");
    expect(baseRaceName("Paris-Roubaix")).toBe("Paris-Roubaix");
  });
});

describe("shortenRiderName", () => {
  it("shortens a 'First Last' name to 'F. Last'", () => {
    expect(shortenRiderName("Tadej Pogacar")).toBe("T. Pogacar");
    expect(shortenRiderName("Mathieu van der Poel")).toBe("M. van der Poel");
  });

  it("returns single-word names unchanged", () => {
    expect(shortenRiderName("Pogacar")).toBe("Pogacar");
  });
});

describe("formatBonusEur", () => {
  it("formats a positive amount with thousands separator and EUR sign", () => {
    expect(formatBonusEur(12000)).toBe("+12 000€");
    expect(formatBonusEur(8500)).toBe("+8 500€");
  });

  it("returns the em-dash for zero amounts", () => {
    expect(formatBonusEur(0)).toBe("—");
  });
});

describe("formatRaceDateLabel", () => {
  it("formats an ISO date as English short label", () => {
    expect(formatRaceDateLabel("2026-05-04")).toBe("4 May");
    expect(formatRaceDateLabel("2026-05-15")).toBe("15 May");
  });
});
