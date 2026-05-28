import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mockRpc }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { launchFirstAuction } from "./actions";

const LEAGUE = "00000000-0000-4000-8000-000000000001";

describe("launchFirstAuction", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("rejects invalid league id (Zod fail)", async () => {
    const res = await launchFirstAuction("not-a-uuid");
    expect(res).toEqual({ error: "Invalid league id." });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("maps not_commissioner to user-facing copy", async () => {
    mockRpc.mockResolvedValue({
      data: { ok: false, error: "not_commissioner" },
      error: null,
    });
    const res = await launchFirstAuction(LEAGUE);
    expect(res).toEqual({
      error: "Only the Race Director can launch the first auction.",
    });
  });

  it("maps already_started to user-facing copy", async () => {
    mockRpc.mockResolvedValue({
      data: { ok: false, error: "already_started" },
      error: null,
    });
    const res = await launchFirstAuction(LEAGUE);
    expect(res).toEqual({ error: "The league has already started." });
  });

  it("maps unauthenticated to user-facing copy", async () => {
    mockRpc.mockResolvedValue({
      data: { ok: false, error: "unauthenticated" },
      error: null,
    });
    const res = await launchFirstAuction(LEAGUE);
    expect(res).toEqual({ error: "Not authenticated." });
  });

  it("maps league_not_found to user-facing copy", async () => {
    mockRpc.mockResolvedValue({
      data: { ok: false, error: "league_not_found" },
      error: null,
    });
    const res = await launchFirstAuction(LEAGUE);
    expect(res).toEqual({ error: "League not found." });
  });

  it("returns generic error on transport failure", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await launchFirstAuction(LEAGUE);
    expect(res).toEqual({ error: "Failed to launch the auction." });
  });
});
