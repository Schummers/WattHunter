/**
 * Cross-round solvency regression test.
 *
 * The place_bid RPC (SECURITY DEFINER) handles cross-round solvency atomically
 * in Postgres. These tests verify the TS action correctly forwards RPC results.
 */

import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — declared before any imports
// ---------------------------------------------------------------------------

const { mockFrom, mockGetUser, mockRpc } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockGetUser = vi.fn();
  const mockRpc = vi.fn();
  return { mockFrom, mockGetUser, mockRpc };
});

const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: mockFrom,
  rpc: mockRpc,
};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));
vi.mock("@/lib/phases", () => ({
  getCurrentPhase: () => ({ id: 4, label: "Giro d'Italia" }),
}));

import { placeBid } from "./actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID_AUCTION = "550e8400-e29b-41d4-a716-446655440010";
const UUID_RIDER_B = "550e8400-e29b-41d4-a716-446655440012";

// ---------------------------------------------------------------------------
// Cross-round solvency tests
// ---------------------------------------------------------------------------

describe("placeBid — cross-round solvency (via RPC)", () => {
  it("rejects a bid when RPC reports insufficient budget (cross-round sum exceeds treasury)", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { error: "Insufficient budget" },
      error: null,
    });

    const result = await placeBid({
      auctionId: UUID_AUCTION,
      riderId: UUID_RIDER_B,
      amount: 100_000,
      round: 2,
    });

    expect(result.error).toMatch(/[Ii]nsufficient/);
  });

  it("allows a bid when RPC confirms cross-round total stays within treasury", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: true, bid_id: "550e8400-e29b-41d4-a716-446655440099" },
      error: null,
    });

    const result = await placeBid({
      auctionId: UUID_AUCTION,
      riderId: UUID_RIDER_B,
      amount: 100_000,
      round: 2,
    });

    expect(result).toEqual({ success: true });
  });

  it("rejects a bid when RPC reports phase already started (late joiner)", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { error: "Phase already started — join before Round 1 closes to participate" },
      error: null,
    });

    const result = await placeBid({
      auctionId: UUID_AUCTION,
      riderId: UUID_RIDER_B,
      amount: 50_000,
      round: 2,
    });

    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/Phase already started/);
  });
});
