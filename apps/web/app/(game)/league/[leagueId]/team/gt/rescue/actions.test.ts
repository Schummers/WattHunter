import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRpc, mockRevalidatePath } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mockRpc })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { placeEmergencyBid } from "./actions";

const VALID_INPUT = {
  riderId: "550e8400-e29b-41d4-a716-446655440001",
  amount: 50000,
  phaseId: 4,
  gtIdentifier: "giro-d-italia",
  gtYear: 2026,
  leagueId: "550e8400-e29b-41d4-a716-446655440002",
};

describe("placeEmergencyBid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revalidates the league home page on success", async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true }, error: null });

    await placeEmergencyBid(VALID_INPUT);

    expect(mockRevalidatePath).toHaveBeenCalledWith(
      `/league/${VALID_INPUT.leagueId}`
    );
  });

  it("does not revalidate on RPC error", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "no DNF refund claimed" } });

    const result = await placeEmergencyBid(VALID_INPUT);

    expect(result).toEqual({ error: "no DNF refund claimed" });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("returns error on invalid input", async () => {
    const result = await placeEmergencyBid({ ...VALID_INPUT, amount: 999 });
    expect(result).toEqual({ error: "Invalid input" });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
