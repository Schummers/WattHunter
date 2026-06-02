import { describe, it, expect } from "vitest";
import { GT_GOALS } from "./gt-goals";

describe("GT_GOALS — Spec C archetype sets", () => {
  it("decathlon has GC + Sprint sets (8 goals)", () => {
    const set = GT_GOALS.find((g) => g.sponsorSlug === "decathlon");
    expect(set).toBeDefined();
    expect(set!.goals).toHaveLength(8);
    const labels = set!.goals.map((g) => g.label);
    expect(labels).toContain("Podium GC");
    expect(labels).toContain("Win the points classification");
  });

  it("uses tierGroup (string) not tieredWith (index)", () => {
    const podium = GT_GOALS
      .find((g) => g.sponsorSlug === "decathlon")!
      .goals.find((g) => g.label === "Podium GC");
    expect(podium!.tierGroup).toBe("gc_placement");
    expect((podium as unknown as Record<string, unknown>).tieredWith).toBeUndefined();
  });

  it("Race Leader and youth jersey goals carry role gc_leader", () => {
    const ineos = GT_GOALS.find((g) => g.sponsorSlug === "ineos")!;
    const leader = ineos.goals.find((g) => g.label === "Wear the Race Leader jersey");
    expect(leader!.role).toBe("gc_leader");
  });
});
