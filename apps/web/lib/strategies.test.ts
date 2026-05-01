import { describe, it, expect } from "vitest";
import {
  STRATEGY_TYPES,
  getMaxActiveStrategies,
  getStrategyBySlug,
} from "./strategies";

describe("STRATEGY_TYPES", () => {
  it("contains the 4 design-spec strategies", () => {
    const slugs = STRATEGY_TYPES.map((s) => s.slug);
    expect(slugs).toEqual(["specialist", "national_pride", "team_chemistry", "young_blood"]);
  });

  it("has the unlock levels per the design spec (1, 3, 5, 7)", () => {
    const byName = Object.fromEntries(STRATEGY_TYPES.map((s) => [s.name, s.unlockLevel]));
    expect(byName).toEqual({
      Speciality: 1,
      Nationality: 3,
      Teams: 5,
      Age: 7,
    });
  });

  it("each strategy has all required fields populated", () => {
    for (const s of STRATEGY_TYPES) {
      expect(s.slug).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.icon).toBeTruthy();
      expect(typeof s.unlockLevel).toBe("number");
      expect(s.paramKey).toBeTruthy();
    }
  });

  it("Speciality offers the 4 expected specialty options", () => {
    const speciality = STRATEGY_TYPES.find((s) => s.slug === "specialist");
    expect(speciality?.options).toEqual(["GC", "Sprint", "TT", "OneDay"]);
  });

  it("Age offers the 3 cap options aligned with Road Warriors design", () => {
    const age = STRATEGY_TYPES.find((s) => s.slug === "young_blood");
    expect(age?.options).toEqual(["23", "25", "28"]);
  });

  it("Nationality and Teams options are dynamic (loaded from DB)", () => {
    const nationality = STRATEGY_TYPES.find((s) => s.slug === "national_pride");
    const teams = STRATEGY_TYPES.find((s) => s.slug === "team_chemistry");
    expect(nationality?.options).toBeNull();
    expect(teams?.options).toBeNull();
  });
});

describe("getMaxActiveStrategies", () => {
  it("level 1: max 1 active strategy", () => {
    expect(getMaxActiveStrategies(1)).toBe(1);
  });

  it("level 2: still max 1 active strategy", () => {
    expect(getMaxActiveStrategies(2)).toBe(1);
  });

  it("level 3 unlocks slot 2: max 2", () => {
    expect(getMaxActiveStrategies(3)).toBe(2);
  });

  it("levels 4-6 keep 2 slots", () => {
    expect(getMaxActiveStrategies(4)).toBe(2);
    expect(getMaxActiveStrategies(5)).toBe(2);
    expect(getMaxActiveStrategies(6)).toBe(2);
  });

  it("level 7 unlocks slot 3: max 3", () => {
    expect(getMaxActiveStrategies(7)).toBe(3);
  });

  it("level 8 keeps 3 slots", () => {
    expect(getMaxActiveStrategies(8)).toBe(3);
  });
});

describe("getStrategyBySlug", () => {
  it("finds a strategy by slug", () => {
    const s = getStrategyBySlug("specialist");
    expect(s?.name).toBe("Speciality");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getStrategyBySlug("unknown")).toBeUndefined();
  });

  it("is case-sensitive", () => {
    expect(getStrategyBySlug("SPECIALIST")).toBeUndefined();
  });
});
