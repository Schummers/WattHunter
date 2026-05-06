import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOpenAuction } from "../get-open-auction";

const { mockMaybeSingle, mockUpdateEq } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockUpdateEq = vi.fn();
  return { mockMaybeSingle, mockUpdateEq };
});

vi.mock("@supabase/supabase-js", () => ({}));

function buildSupabaseMock() {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnValue({
        eq: mockUpdateEq,
      }),
      maybeSingle: mockMaybeSingle,
    }),
  } as any;
}

const LEAGUE_ID = "00000000-0000-4000-8000-000000000001";
const OPEN_ROUND = { id: "round-id-1", name: "Round 1" };
const DUE_ROUND = { id: "round-id-2", name: "Round 2" };

describe("getOpenAuction", () => {
  beforeEach(() => {
    mockMaybeSingle.mockReset();
    mockUpdateEq.mockReset();
  });

  it("returns the open round when one exists (no lazy-open needed)", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: OPEN_ROUND, error: null });
    const supabase = buildSupabaseMock();
    const result = await getOpenAuction(supabase, LEAGUE_ID);
    expect(result).toEqual(OPEN_ROUND);
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    expect(mockUpdateEq).not.toHaveBeenCalled();
  });

  it("returns null when no open round and no due scheduled round", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const supabase = buildSupabaseMock();
    const result = await getOpenAuction(supabase, LEAGUE_ID);
    expect(result).toBeNull();
    expect(mockUpdateEq).not.toHaveBeenCalled();
  });

  it("lazy-opens the due round and returns it", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: DUE_ROUND, error: null });
    mockUpdateEq.mockResolvedValueOnce({ error: null });
    const supabase = buildSupabaseMock();
    const result = await getOpenAuction(supabase, LEAGUE_ID);
    expect(result).toEqual(DUE_ROUND);
    expect(mockUpdateEq).toHaveBeenCalledWith("id", DUE_ROUND.id);
  });

  it("returns null when scheduled round exists but opens_at is in the future", async () => {
    // .lte() filters out future rounds — DB returns null for step 2
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const supabase = buildSupabaseMock();
    const result = await getOpenAuction(supabase, LEAGUE_ID);
    expect(result).toBeNull();
  });

  it("returns null when UPDATE to open the round fails", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: DUE_ROUND, error: null });
    mockUpdateEq.mockResolvedValueOnce({ error: { message: "db error" } });
    const supabase = buildSupabaseMock();
    const result = await getOpenAuction(supabase, LEAGUE_ID);
    expect(result).toBeNull();
  });
});
