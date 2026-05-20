import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRpc, mockGetUser } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    rpc: mockRpc,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/phases", () => ({
  getCurrentPhase: () => ({ id: 4, label: "Giro d'Italia" }),
}));

import { releaseRider } from "./actions";

const CONTRACT_ID = "cccccccc-0000-4000-8000-000000000001";

describe("releaseRider (via RPC)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("returns error for invalid UUID", async () => {
    const result = await releaseRider("not-a-uuid");
    expect(result).toEqual({ error: "Invalid data" });
  });

  it("returns error when not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await releaseRider(CONTRACT_ID);
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("forwards RPC auth error", async () => {
    mockRpc.mockResolvedValueOnce({ data: { error: "Not authenticated" }, error: null });
    const result = await releaseRider(CONTRACT_ID);
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("forwards RPC contract-not-found error", async () => {
    mockRpc.mockResolvedValueOnce({ data: { error: "Contract not found" }, error: null });
    const result = await releaseRider(CONTRACT_ID);
    expect(result).toEqual({ error: "Contract not found" });
  });

  it("forwards RPC not-authorized error", async () => {
    mockRpc.mockResolvedValueOnce({ data: { error: "Not authorized" }, error: null });
    const result = await releaseRider(CONTRACT_ID);
    expect(result).toEqual({ error: "Not authorized" });
  });

  it("forwards RPC phase-lock error", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { error: "Cannot release a rider recruited during the current phase" },
      error: null,
    });
    const result = await releaseRider(CONTRACT_ID);
    expect(result).toEqual({ error: "Cannot release a rider recruited during the current phase" });
  });

  it("returns success on happy path", async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const result = await releaseRider(CONTRACT_ID);
    expect(result).toEqual({ success: true });
  });

  it("passes current phase id to RPC", async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await releaseRider(CONTRACT_ID);
    expect(mockRpc).toHaveBeenCalledWith("release_rider", {
      p_contract_id: CONTRACT_ID,
      p_current_phase_id: 4,
    });
  });
});
