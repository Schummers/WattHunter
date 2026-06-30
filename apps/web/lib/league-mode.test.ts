import { describe, it, expect } from "vitest";
import { isClassic, CLASSIC_PHASE_BUDGET, CLASSIC_SQUAD_SIZE, classicTeamDefaults } from "./league-mode";

describe("league-mode", () => {
  it("isClassic is true only for classic", () => {
    expect(isClassic("classic")).toBe(true);
    expect(isClassic("manager")).toBe(false);
    expect(isClassic(null)).toBe(false);
    expect(isClassic(undefined)).toBe(false);
  });
  it("exposes the classic constants", () => {
    expect(CLASSIC_PHASE_BUDGET).toBe(2_000_000);
    expect(CLASSIC_SQUAD_SIZE).toBe(10);
  });
  it("classicTeamDefaults returns level 8, flat budget, underdog off, no sponsor", () => {
    expect(classicTeamDefaults()).toEqual({
      starting_level: 8,
      treasury: 2_000_000,
      underdog_eligible: false,
      assignSponsor: false,
    });
  });
});
