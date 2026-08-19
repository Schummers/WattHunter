import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOpenAuction } from "../get-open-auction";

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({}));

function buildSupabaseMock() {
  return { rpc: mockRpc } as any;
}

const LEAGUE_ID = "00000000-0000-4000-8000-000000000001";

describe("getOpenAuction", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("returns the already-open round without opening anything", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: true, id: "round-id-1", name: "Round 1", opened: false },
      error: null,
    });

    const result = await getOpenAuction(buildSupabaseMock(), LEAGUE_ID);

    expect(result).toEqual({ id: "round-id-1", name: "Round 1" });
    expect(mockRpc).toHaveBeenCalledWith("open_due_auction", {
      p_league_id: LEAGUE_ID,
    });
  });

  it("returns the round the RPC just opened", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: true, id: "round-id-2", name: "Round 2", opened: true },
      error: null,
    });

    const result = await getOpenAuction(buildSupabaseMock(), LEAGUE_ID);

    expect(result).toEqual({ id: "round-id-2", name: "Round 2" });
  });

  it("returns null when nothing is open and nothing is due", async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true, id: null }, error: null });

    const result = await getOpenAuction(buildSupabaseMock(), LEAGUE_ID);

    expect(result).toBeNull();
  });

  it("returns null when the RPC rejects the caller", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { error: "Not a member of this league" },
      error: null,
    });

    const result = await getOpenAuction(buildSupabaseMock(), LEAGUE_ID);

    expect(result).toBeNull();
  });

  it("returns null when the RPC call itself fails", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "db error" } });

    const result = await getOpenAuction(buildSupabaseMock(), LEAGUE_ID);

    expect(result).toBeNull();
  });

  it("tolerates a missing name on the returned round", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: true, id: "round-id-3", name: null },
      error: null,
    });

    const result = await getOpenAuction(buildSupabaseMock(), LEAGUE_ID);

    expect(result).toEqual({ id: "round-id-3", name: "" });
  });
});
