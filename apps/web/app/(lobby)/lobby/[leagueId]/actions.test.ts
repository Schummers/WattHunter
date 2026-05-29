import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mockRpc }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { setStartingLevel } from "./actions";

const LEAGUE = "00000000-0000-4000-8000-000000000001";

describe("setStartingLevel", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("rejects invalid league id", async () => {
    const res = await setStartingLevel("not-a-uuid", 3);
    expect(res).toEqual({ ok: false, error: "Invalid request." });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects out-of-range levels", async () => {
    const res = await setStartingLevel(LEAGUE, 9);
    expect(res).toEqual({ ok: false, error: "Invalid request." });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls the RPC and returns ok on success", async () => {
    mockRpc.mockResolvedValue({ data: { ok: true, level: 4 }, error: null });
    const res = await setStartingLevel(LEAGUE, 4);
    expect(mockRpc).toHaveBeenCalledWith("set_starting_level", {
      p_league_id: LEAGUE,
      p_level: 4,
    });
    expect(res).toEqual({ ok: true });
  });

  it("maps not_commissioner to the user-facing copy", async () => {
    mockRpc.mockResolvedValue({
      data: { ok: false, error: "not_commissioner" },
      error: null,
    });
    const res = await setStartingLevel(LEAGUE, 4);
    expect(res).toEqual({
      ok: false,
      error: "Only the Race Director can change the level.",
    });
  });

  it("maps already_started to its copy", async () => {
    mockRpc.mockResolvedValue({
      data: { ok: false, error: "already_started" },
      error: null,
    });
    const res = await setStartingLevel(LEAGUE, 4);
    expect(res).toEqual({
      ok: false,
      error: "The league has already started.",
    });
  });

  it("returns generic error on transport failure", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await setStartingLevel(LEAGUE, 4);
    expect(res).toEqual({ ok: false, error: "Failed to update level." });
  });
});
