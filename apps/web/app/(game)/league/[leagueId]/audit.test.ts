import { describe, it, expect } from "vitest";
import { LEVELS, getLevelByNumber, getMaxSlots } from "@/lib/levels";

// ---------------------------------------------------------------------------
// T5: Level gating cross-validation (TS side)
// ---------------------------------------------------------------------------
describe("Level gating consistency", () => {
  it("all 8 levels have unique poolMin values", () => {
    const poolMins = LEVELS.map((l) => l.poolMin);
    const unique = new Set(poolMins);
    expect(unique.size).toBe(8);
  });

  it("poolMin decreases as level increases (higher level = access to better riders)", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].poolMin).toBeLessThan(LEVELS[i - 1].poolMin);
    }
  });

  it("level 1 pool starts at 300", () => {
    expect(getLevelByNumber(1).poolMin).toBe(300);
  });

  it("level 8 pool starts at 1 (all riders)", () => {
    expect(getLevelByNumber(8).poolMin).toBe(1);
  });

  it("boundary: level 0 clamps to level 1", () => {
    expect(getLevelByNumber(0).poolMin).toBe(getLevelByNumber(1).poolMin);
  });

  it("boundary: level 9 clamps to level 8", () => {
    expect(getLevelByNumber(9).poolMin).toBe(getLevelByNumber(8).poolMin);
  });
});

// ---------------------------------------------------------------------------
// T8: Sponsor eligibility (unlock_level + slot)
// ---------------------------------------------------------------------------
describe("Level progression", () => {
  it("slots increase from 6 to 12", () => {
    expect(getMaxSlots(1)).toBe(6);
    expect(getMaxSlots(8)).toBe(12);
  });

  it("slots never decrease as level increases", () => {
    for (let level = 2; level <= 8; level++) {
      expect(getMaxSlots(level)).toBeGreaterThanOrEqual(getMaxSlots(level - 1));
    }
  });

  it("XP thresholds are strictly increasing", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].xp).toBeGreaterThan(LEVELS[i - 1].xp);
    }
  });

  it("maxActive policies: 1 at level 1-2, 2 at level 3-6, 3 at level 7-8", () => {
    expect(getLevelByNumber(1).maxActive).toBe(1);
    expect(getLevelByNumber(2).maxActive).toBe(1);
    expect(getLevelByNumber(3).maxActive).toBe(2);
    expect(getLevelByNumber(4).maxActive).toBe(2);
    expect(getLevelByNumber(5).maxActive).toBe(2);
    expect(getLevelByNumber(6).maxActive).toBe(2);
    expect(getLevelByNumber(7).maxActive).toBe(3);
    expect(getLevelByNumber(8).maxActive).toBe(3);
  });
});
