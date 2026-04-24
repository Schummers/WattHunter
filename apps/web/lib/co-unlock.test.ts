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
