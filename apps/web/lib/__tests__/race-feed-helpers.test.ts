import { describe, it, expect } from "vitest";
import {
  detectRaceType,
  getParentRaceSlug,
  getParentRaceLabel,
  formatRaceTitle,
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
  it("formats a stage title as '<ParentLabel> · Etape N'", () => {
    expect(
      formatRaceTitle({
        raceType: "stage",
        raceName: "Giro d'Italia - Stage 2",
        raceSlug: "race/giro-d-italia/2026/stage-2",
        parentRaceLabel: "Giro",
      })
    ).toBe("Giro · Étape 2");
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
  it("formats an ISO date as French short label", () => {
    expect(formatRaceDateLabel("2026-05-04")).toBe("4 mai");
    expect(formatRaceDateLabel("2026-05-15")).toBe("15 mai");
  });
});
