import { vi, describe, it, expect, beforeEach } from "vitest";
import { getOpenAuction } from "../get-open-auction";

const mockMaybeSingle = vi.fn();
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });

const mockSupabase = {
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

describe("getOpenAuction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup the mock chain after clearAllMocks
    mockUpdateEq.mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnValue({
        eq: mockUpdateEq,
      }),
      maybeSingle: mockMaybeSingle,
    });
  });

  it("returns the open round when one exists (step 1 hit, no step 2/3)", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: "round-1", name: "Round 1" },
      error: null,
    });

    const result = await getOpenAuction(mockSupabase, "league-abc");

    expect(result).toEqual({ id: "round-1", name: "Round 1" });
    // maybeSingle should only be called once (step 1 short-circuits)
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    // update should NOT have been called
    expect(mockUpdateEq).not.toHaveBeenCalled();
  });

  it("returns null when no open round and no due scheduled round", async () => {
    // Step 1: no open round
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Step 2: no scheduled round due
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await getOpenAuction(mockSupabase, "league-abc");

    expect(result).toBeNull();
    expect(mockMaybeSingle).toHaveBeenCalledTimes(2);
    expect(mockUpdateEq).not.toHaveBeenCalled();
  });

  it("lazy-opens and returns the due round when a scheduled round has opens_at <= now()", async () => {
    // Step 1: no open round
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Step 2: scheduled round that is due
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: "round-2", name: "Round 2" },
      error: null,
    });

    const result = await getOpenAuction(mockSupabase, "league-abc");

    expect(result).toEqual({ id: "round-2", name: "Round 2" });
    expect(mockMaybeSingle).toHaveBeenCalledTimes(2);
    // update should have been called once to open the round
    expect(mockUpdateEq).toHaveBeenCalledTimes(1);
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "round-2");
  });

  it("returns null when there is a scheduled round but opens_at > now() (not yet due)", async () => {
    // Step 1: no open round
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Step 2: the .lte filter excludes future rounds — DB returns null
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await getOpenAuction(mockSupabase, "league-abc");

    expect(result).toBeNull();
    expect(mockMaybeSingle).toHaveBeenCalledTimes(2);
    expect(mockUpdateEq).not.toHaveBeenCalled();
  });
});
