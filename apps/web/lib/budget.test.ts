import { describe, it, expect } from "vitest";
import { BID_INCREMENT, computeAvailableBudget } from "./budget";

describe("BID_INCREMENT", () => {
  it("matches the design rule: bids step by 1000€", () => {
    expect(BID_INCREMENT).toBe(1000);
  });
});

describe("computeAvailableBudget", () => {
  describe("phase already confirmed (payday already ran)", () => {
    it("returns treasury when no drafts", () => {
      expect(computeAvailableBudget(200_000, 0, 0, 0, true)).toBe(200_000);
    });

    it("subtracts draft bids from treasury", () => {
      expect(computeAvailableBudget(200_000, 0, 0, 50_000, true)).toBe(150_000);
    });

    it("returns negative when drafts exceed treasury", () => {
      expect(computeAvailableBudget(100_000, 0, 0, 150_000, true)).toBe(-50_000);
    });

    it("ignores sponsorIncome and activeSalaries (they are already baked into treasury)", () => {
      // treasury already reflects sponsor in - salaries out — passing them again
      // would double-count
      expect(computeAvailableBudget(200_000, 999_999, 999_999, 50_000, true)).toBe(150_000);
    });

    it("treats zero treasury and zero drafts as zero", () => {
      expect(computeAvailableBudget(0, 0, 0, 0, true)).toBe(0);
    });
  });

  describe("phase NOT confirmed (during Round 1, treasury is pre-payday)", () => {
    it("projects sponsor income and subtracts active salaries", () => {
      // 200K treasury + 300K sponsor - 100K salaries - 50K drafts = 350K
      expect(computeAvailableBudget(200_000, 300_000, 100_000, 50_000, false)).toBe(350_000);
    });

    it("returns zero when commitments exactly match available", () => {
      // 100K + 50K - 100K - 50K = 0
      expect(computeAvailableBudget(100_000, 50_000, 100_000, 50_000, false)).toBe(0);
    });

    it("returns negative when commitments exceed available", () => {
      // 50K + 100K - 100K - 100K = -50K
      expect(computeAvailableBudget(50_000, 100_000, 100_000, 100_000, false)).toBe(-50_000);
    });

    it("handles zero sponsor and zero salaries (e.g. brand-new team)", () => {
      expect(computeAvailableBudget(200_000, 0, 0, 50_000, false)).toBe(150_000);
    });
  });

  describe("phaseConfirmed default", () => {
    it("defaults to false (Round 1 / pre-payday) when omitted", () => {
      // Without explicit phaseConfirmed, sponsor and salaries should apply
      const explicitFalse = computeAvailableBudget(200_000, 300_000, 100_000, 50_000, false);
      const omitted = computeAvailableBudget(200_000, 300_000, 100_000, 50_000);
      expect(omitted).toBe(explicitFalse);
    });
  });
});
