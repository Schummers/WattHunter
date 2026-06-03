import { describe, it, expect } from "vitest";
import { getGTSubTabLabel } from "../gt-phases";

describe("getGTSubTabLabel", () => {
  it("returns 'Race Team' when no GT phase is active and no override is given", () => {
    // 2026-04-01 — between phases, no GT active
    const d = new Date("2026-04-01T12:00:00Z");
    expect(getGTSubTabLabel(d)).toBe("Race Team");
  });

  it("returns the GT short label during an active GT phase", () => {
    // 2026-05-15 — mid-Giro (phase id 4)
    const d = new Date("2026-05-15T12:00:00Z");
    expect(getGTSubTabLabel(d)).toBe("Giro Team");
  });

  it("respects the override when provided, regardless of date", () => {
    const d = new Date("2026-04-01T12:00:00Z");
    expect(getGTSubTabLabel(d, { override: "Paris-Nice Team" })).toBe(
      "Paris-Nice Team",
    );
  });

  it("override wins over an active GT phase too", () => {
    const d = new Date("2026-05-15T12:00:00Z");
    expect(getGTSubTabLabel(d, { override: "Tour de France Team" })).toBe(
      "Tour de France Team",
    );
  });
});
