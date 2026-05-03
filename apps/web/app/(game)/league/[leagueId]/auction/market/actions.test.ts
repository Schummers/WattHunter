import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockGetUser, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/phases", () => ({
  getCurrentPhase: () => ({ id: 4, label: "Giro d'Italia" }),
  getPhaseRange: () => ({ start: new Date("2099-01-01"), end: new Date("2099-12-31") }),
}));

import { confirmPhaseSetup } from "./actions";

const TEAM_ID = "bbbbbbbb-0000-4000-8000-000000000001";

describe("confirmPhaseSetup (via RPC)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("forwards RPC auth error", async () => {
    mockRpc.mockResolvedValueOnce({ data: { error: "Not authenticated" }, error: null });
    const result = await confirmPhaseSetup(TEAM_ID);
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("forwards RPC already-confirmed error", async () => {
    mockRpc.mockResolvedValueOnce({ data: { error: "Already confirmed for this phase" }, error: null });
    const result = await confirmPhaseSetup(TEAM_ID);
    expect(result).toEqual({ error: "Already confirmed for this phase" });
  });

  it("returns success with phase info on happy path", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: true, phaseId: 4, phaseLabel: "Giro d'Italia" },
      error: null,
    });
    const result = await confirmPhaseSetup(TEAM_ID);
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("phaseId", 4);
    expect(result).toHaveProperty("phaseLabel", "Giro d'Italia");
  });
});
