import { describe, it, expect } from "vitest";
import { getMinLevelForRiderRank } from "./co-unlock";

describe("getMinLevelForRiderRank", () => {
  it("rank 1 requires Lv.8", () => {
    expect(getMinLevelForRiderRank(1)).toBe(8);
  });

  it("rank 3 requires Lv.8", () => {
    expect(getMinLevelForRiderRank(3)).toBe(8);
  });

  it("rank 4 requires Lv.7", () => {
    expect(getMinLevelForRiderRank(4)).toBe(7);
  });

  it("rank 9 requires Lv.7", () => {
    expect(getMinLevelForRiderRank(9)).toBe(7);
  });

  it("rank 10 requires Lv.6", () => {
    expect(getMinLevelForRiderRank(10)).toBe(6);
  });

  it("rank 19 requires Lv.6", () => {
    expect(getMinLevelForRiderRank(19)).toBe(6);
  });

  it("rank 20 requires Lv.5", () => {
    expect(getMinLevelForRiderRank(20)).toBe(5);
  });

  it("rank 30 requires Lv.4", () => {
    expect(getMinLevelForRiderRank(30)).toBe(4);
  });

  it("rank 100 requires Lv.3", () => {
    expect(getMinLevelForRiderRank(100)).toBe(3);
  });

  it("rank 300 requires Lv.1", () => {
    expect(getMinLevelForRiderRank(300)).toBe(1);
  });

  it("rank 600 requires Lv.1", () => {
    expect(getMinLevelForRiderRank(600)).toBe(1);
  });

  it("returns 1 for rank beyond the pool (safe fallback)", () => {
    expect(getMinLevelForRiderRank(1000)).toBe(1);
  });
});

import { computeCoUnlockStatus } from "./co-unlock";

describe("computeCoUnlockStatus", () => {
  // Pure function: given league team levels and a rider rank, return the lock status.
  it("unlocked when 2 teams at required level", () => {
    const status = computeCoUnlockStatus({
      riderPcsRank: 1, // needs Lv.8
      leagueTeamLevels: [8, 8, 7, 6, 5],
    });
    expect(status).toEqual({
      minLevel: 8,
      playersAtOrAboveLevel: 2,
      playersNeededToUnlock: 0,
      isUnlocked: true,
    });
  });

  it("locked when only 1 team at required level", () => {
    const status = computeCoUnlockStatus({
      riderPcsRank: 1, // needs Lv.8
      leagueTeamLevels: [8, 7, 6, 5, 4],
    });
    expect(status).toEqual({
      minLevel: 8,
      playersAtOrAboveLevel: 1,
      playersNeededToUnlock: 1,
      isUnlocked: false,
    });
  });

  it("unlocked for low-rank rider accessible by most teams", () => {
    const status = computeCoUnlockStatus({
      riderPcsRank: 300,
      leagueTeamLevels: [3, 2, 1, 1],
    });
    expect(status.isUnlocked).toBe(true);
    expect(status.minLevel).toBe(1);
    expect(status.playersAtOrAboveLevel).toBe(4);
  });

  it("locked when no team has reached the required level yet", () => {
    const status = computeCoUnlockStatus({
      riderPcsRank: 1, // needs Lv.8
      leagueTeamLevels: [6, 5, 4, 3],
    });
    expect(status.isUnlocked).toBe(false);
    expect(status.playersAtOrAboveLevel).toBe(0);
    expect(status.playersNeededToUnlock).toBe(2);
  });

  it("always unlocked when rider has no rank (defensive)", () => {
    const status = computeCoUnlockStatus({
      riderPcsRank: null,
      leagueTeamLevels: [1],
    });
    expect(status.isUnlocked).toBe(true);
  });
});

describe("co-unlock error message format (used by placeBid)", () => {
  it("produces the pluralized template that placeBid echoes back", () => {
    const status = computeCoUnlockStatus({
      riderPcsRank: 1,
      leagueTeamLevels: [8, 5, 4],
    });
    const message = `Locked — unlock when ${status.playersNeededToUnlock} more player(s) reach Lv.${status.minLevel}`;
    expect(message).toBe("Locked — unlock when 1 more player(s) reach Lv.8");
  });
});
