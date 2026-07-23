import { describe, expect, it } from "vitest";
import { fetchAllSupabasePages } from "./supabase-pagination";

describe("fetchAllSupabasePages", () => {
  it("fetches the page after Supabase's 1,000-row limit", async () => {
    const firstPage = Array.from({ length: 1_000 }, (_, index) => ({
      id: `xp-${index}`,
      xp_gained: 1,
    }));
    const TourRow = { id: "tour-las-chivas", xp_gained: 1_588.74 };
    const calls: Array<[number, number]> = [];
    const fetchPage = async (from: number, to: number) => {
      calls.push([from, to]);
      if (from === 0 && to === 999) return { data: firstPage };
      if (from === 1_000 && to === 1_999) return { data: [TourRow] };
      return { data: [] };
    };

    const rows = await fetchAllSupabasePages(fetchPage);

    expect(rows).toHaveLength(1_001);
    expect(rows.at(-1)).toEqual(TourRow);
    expect(calls).toEqual([[0, 999], [1_000, 1_999]]);
  });
});
