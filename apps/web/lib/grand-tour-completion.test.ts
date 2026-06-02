import { describe, it, expect } from "vitest";
import { completedGrandTourYears, GT_FINAL_STAGE } from "./grand-tour-completion";

// Helper builders to keep the cases readable
const stage = (year: number, n: number) => ({
  race_slug: `race/giro-d-italia/${year}/stage-${n}`,
  stage: `stage-${n}`,
});
const scoredGc = (year: number) => ({
  race_slug: `race/giro-d-italia/${year}/gc`,
});

describe("completedGrandTourYears", () => {
  it("does NOT complete mid-race (latest synced stage < final, GC not scored)", () => {
    // Giro 2026 only synced up to stage 15, no scored GC yet → the live KOM
    // leader must NOT unlock the jersey. This is the reported bug.
    const stages = Array.from({ length: 15 }, (_, i) => stage(2026, i + 1));
    const result = completedGrandTourYears("giro-d-italia", stages, []);
    expect(result.has("2026")).toBe(false);
  });

  it("does NOT complete when final stage is present but GC is not scored yet (signal B fails)", () => {
    const stages = Array.from({ length: GT_FINAL_STAGE }, (_, i) => stage(2026, i + 1));
    const result = completedGrandTourYears("giro-d-italia", stages, []);
    expect(result.has("2026")).toBe(false);
  });

  it("does NOT complete when GC is scored but final stage is missing (signal A fails)", () => {
    const stages = Array.from({ length: 18 }, (_, i) => stage(2026, i + 1));
    const result = completedGrandTourYears("giro-d-italia", stages, [scoredGc(2026)]);
    expect(result.has("2026")).toBe(false);
  });

  it("completes only when BOTH signals hold (final stage present AND GC scored)", () => {
    const stages = Array.from({ length: GT_FINAL_STAGE }, (_, i) => stage(2026, i + 1));
    const result = completedGrandTourYears("giro-d-italia", stages, [scoredGc(2026)]);
    expect(result.has("2026")).toBe(true);
  });

  it("isolates years: a finished past Giro completes while the current one is in progress", () => {
    const stages = [
      // 2025 fully synced
      ...Array.from({ length: GT_FINAL_STAGE }, (_, i) => stage(2025, i + 1)),
      // 2026 only up to stage 12
      ...Array.from({ length: 12 }, (_, i) => stage(2026, i + 1)),
    ];
    const result = completedGrandTourYears("giro-d-italia", stages, [scoredGc(2025)]);
    expect(result.has("2025")).toBe(true);
    expect(result.has("2026")).toBe(false);
  });

  it("ignores stage rows from other Grand Tours", () => {
    const stages = [
      { race_slug: "race/tour-de-france/2026/stage-21", stage: "stage-21" },
    ];
    const scored = [{ race_slug: "race/tour-de-france/2026/gc" }];
    const result = completedGrandTourYears("giro-d-italia", stages, scored);
    expect(result.size).toBe(0);
  });
});
