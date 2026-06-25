import { describe, it, expect } from "vitest";
import { CLASSIC_PHASE_IDS, isClassicPhaseId } from "./classic-phases";

describe("classic-phases", () => {
  it("has exactly 4 phases incl. the 3 GTs", () => {
    expect(CLASSIC_PHASE_IDS).toHaveLength(4);
    expect(CLASSIC_PHASE_IDS).toEqual(expect.arrayContaining([4, 6, 8])); // Giro, Tour, Vuelta
  });
  it("isClassicPhaseId matches the set", () => {
    expect(isClassicPhaseId(6)).toBe(true);
    expect(isClassicPhaseId(2)).toBe(false);
  });
});
