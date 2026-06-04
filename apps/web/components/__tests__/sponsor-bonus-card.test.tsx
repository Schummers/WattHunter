// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SponsorBonusCard } from "../sponsor-bonus-card";
import type { SponsorRow } from "@/lib/sponsors";

// T4 Decathlon-like sponsor: base bonus + GC/Sprint goals + FR nationality.
const decathlon: SponsorRow = {
  id: "s-decathlon",
  name: "Decathlon AG2R",
  slug: "decathlon",
  tier: 4,
  unlock_level: 4,
  monthly_budget: 750_000,
  orientation: "gc",
  nationality: "FR",
  bonus_gc: 10_000,
  bonus_one_day: 10_000,
  bonus_stage: 5_000,
  gc_threshold: 10,
  one_day_threshold: 10,
  stage_threshold: 3,
  has_explicit_prestige: false,
  bonus_monument: null,
  bonus_grand_tour: null,
  monument_threshold: null,
  grand_tour_threshold: null,
  sort_order: 0,
};

describe("SponsorBonusCard — two-value (A/B) layout", () => {
  it("renders base bonus in two columns with B = 2×A and literal 'Top N' labels", () => {
    const { container } = render(
      <SponsorBonusCard sponsor={decathlon} expanded onToggle={() => {}} />,
    );
    const text = container.textContent ?? "";

    // Literal "Top N" labels (no "Podium"/"Victory" baked in)
    expect(text).toContain("GC — Top 10");
    expect(text).toContain("Stage — Top 3");
    expect(text).toContain("One-day — Top 10");
    expect(text).not.toContain("Podium Stage");

    // Base bonus B column = ×2 (GC 10K → 20K, stage 5K → 10K)
    expect(text).toContain("+10K");
    expect(text).toContain("+20K");

    // Goals B column = ×2 (GC podium 30K → 60K)
    expect(text).toContain("+30K");
    expect(text).toContain("+60K");
  });

  it("renders the unified legend: nationality ×1.20 then A/B, never ×1.25", () => {
    const { container } = render(
      <SponsorBonusCard sponsor={decathlon} expanded onToggle={() => {}} />,
    );
    const text = container.textContent ?? "";

    expect(text).toContain("French rider: all bonuses ×1.20");
    expect(text).not.toContain("×1.25");
    expect(text).toContain("1-week race & one-day");
    expect(text).toContain("Grand Tour & Monument (×2)");
  });

  it("collapses to the header only when not expanded", () => {
    const { container } = render(
      <SponsorBonusCard sponsor={decathlon} expanded={false} onToggle={() => {}} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Decathlon AG2R");
    expect(text).not.toContain("Base Bonus");
  });
});
