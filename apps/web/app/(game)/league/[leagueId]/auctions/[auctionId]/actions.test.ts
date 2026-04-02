/**
 * Tests for auction server actions (placeBid, cancelBid).
 *
 * Strategy:
 *  - Zod schema validation is tested without any Supabase call (the guard
 *    returns early before createClient() is invoked).
 *  - Budget/salary checks are tested by mocking createClient() and
 *    controlling what each .from() query returns.
 */

import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — declared before any imports that depend on them
// ---------------------------------------------------------------------------

// Use vi.hoisted() so these are available when vi.mock() factory runs
const { mockFrom, mockGetUser } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockGetUser = vi.fn();
  return { mockFrom, mockGetUser };
});

const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: mockFrom,
};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));
vi.mock("@/lib/phases", () => ({
  getCurrentPhase: () => ({ id: 4, label: "Giro d'Italia" }),
}));

// Import AFTER mocks are declared
import { placeBid, cancelBid } from "./actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Proper RFC-4122 v4 UUIDs (version nibble = 4, variant nibble = 8 or 9 or a/b)
const UUID_1 = "550e8400-e29b-41d4-a716-446655440001";
const UUID_2 = "550e8400-e29b-41d4-a716-446655440002";

/**
 * Creates a thenable that behaves like a Supabase query chain.
 * Awaiting the value resolves to { data, error }.
 * Every builder method (select, eq, …) returns the same chain.
 */
function makeChain(data: unknown = null, error: unknown = null, count: number | null = null) {
  const result = { data, error, count };
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
    catch: (reject: (v: unknown) => unknown) =>
      Promise.resolve(result).catch(reject),
    finally: (cb: () => void) =>
      Promise.resolve(result).finally(cb),
  };
  for (const m of [
    "select", "eq", "neq", "gt", "gte", "lt", "lte", "in",
    "single", "maybeSingle", "update", "insert", "upsert",
  ]) {
    chain[m] = () => chain;
  }
  return chain;
}

// ---------------------------------------------------------------------------
// placeBid — Zod schema validation (no Supabase call needed)
// ---------------------------------------------------------------------------

describe("placeBid — Zod validation", () => {
  it("rejects a non-UUID auctionId", async () => {
    const result = await placeBid({
      auctionId: "not-a-uuid",
      riderId: UUID_1,
      amount: 500,
      round: 1,
    });
    expect(result).toEqual({ error: "Invalid data" });
  });

  it("rejects a non-UUID riderId", async () => {
    const result = await placeBid({
      auctionId: UUID_1,
      riderId: "bad-id",
      amount: 500,
      round: 1,
    });
    expect(result).toEqual({ error: "Invalid data" });
  });

  it("accepts amount that is not a multiple of 100 (RC-4)", async () => {
    // 150 is a valid positive integer — should pass Zod and hit auth
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await placeBid({
      auctionId: UUID_1,
      riderId: UUID_2,
      amount: 150,
      round: 1,
    });
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("rejects amount = 0 (must be positive)", async () => {
    const result = await placeBid({
      auctionId: UUID_1,
      riderId: UUID_2,
      amount: 0,
      round: 1,
    });
    expect(result).toEqual({ error: "Invalid data" });
  });

  it("rejects negative amount", async () => {
    const result = await placeBid({
      auctionId: UUID_1,
      riderId: UUID_2,
      amount: -100,
      round: 1,
    });
    expect(result).toEqual({ error: "Invalid data" });
  });

  it("rejects round = 0 (min is 1)", async () => {
    const result = await placeBid({
      auctionId: UUID_1,
      riderId: UUID_2,
      amount: 500,
      round: 0,
    });
    expect(result).toEqual({ error: "Invalid data" });
  });

  it("rejects round = 4 (max is 3)", async () => {
    const result = await placeBid({
      auctionId: UUID_1,
      riderId: UUID_2,
      amount: 500,
      round: 4,
    });
    expect(result).toEqual({ error: "Invalid data" });
  });

  it("passes validation and proceeds to auth check", async () => {
    // Valid schema → Zod passes → hits auth layer → unauthenticated error
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const result = await placeBid({
      auctionId: UUID_1,
      riderId: UUID_2,
      amount: 500,
      round: 1,
    });
    // Not "Invalid data" — Zod passed; auth returned null user
    expect(result).toEqual({ error: "Not authenticated" });
  });
});

// ---------------------------------------------------------------------------
// placeBid — RC-4 edge cases (any positive integer accepted)
// ---------------------------------------------------------------------------

describe("placeBid — RC-4 edge cases", () => {
  it("accepts odd number like 27033", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await placeBid({
      auctionId: UUID_1,
      riderId: UUID_2,
      amount: 27_033,
      round: 1,
    });
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("rejects amount exceeding 100M", async () => {
    const result = await placeBid({
      auctionId: UUID_1,
      riderId: UUID_2,
      amount: 100_000_001,
      round: 1,
    });
    expect(result).toEqual({ error: "Invalid data" });
  });

  it("accepts amount at 100M cap", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await placeBid({
      auctionId: UUID_1,
      riderId: UUID_2,
      amount: 100_000_000,
      round: 1,
    });
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("accepts amount = 1 (minimum positive)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await placeBid({
      auctionId: UUID_1,
      riderId: UUID_2,
      amount: 1,
      round: 1,
    });
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("rejects float amount", async () => {
    const result = await placeBid({
      auctionId: UUID_1,
      riderId: UUID_2,
      amount: 5000.5,
      round: 1,
    });
    expect(result).toEqual({ error: "Invalid data" });
  });
});

// ---------------------------------------------------------------------------
// placeBid — rider minimum salary check
// ---------------------------------------------------------------------------

describe("placeBid — rider salary minimum", () => {
  it("returns error when bid is below rider monthly_salary", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(makeChain({ league_id: "league-1", status: "open", closes_at: null }))           // auctions
      .mockReturnValueOnce(makeChain({ id: "team-1", treasury: 500_000, phase_confirmed_id: 4 })) // teams
      .mockReturnValueOnce(makeChain({ monthly_salary: 10_000 }));          // riders

    const result = await placeBid({
      auctionId: UUID_1,
      riderId: UUID_2,
      amount: 5_000, // below 10_000
      round: 1,
    });

    expect(result.error).toMatch(/Minimum bid: 10.000 €/);
  });
});

// ---------------------------------------------------------------------------
// placeBid — budget check
// ---------------------------------------------------------------------------

describe("placeBid — budget check", () => {
  it("returns error when total bids would exceed treasury", async () => {
    // treasury = 1_000, other active bids = 800, new bid = 300 → 1_100 > 1_000
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(makeChain({ league_id: "league-1", status: "open", closes_at: null }))                   // auctions
      .mockReturnValueOnce(makeChain({ id: "team-1", treasury: 1_000, phase_confirmed_id: 4 }))          // teams
      .mockReturnValueOnce(makeChain({ monthly_salary: 100 }))                     // riders
      .mockReturnValueOnce(makeChain(null))                                         // existingBid (maybeSingle → null)
      .mockReturnValueOnce(makeChain([]))                                           // existing contracts
      .mockReturnValueOnce(makeChain([{ id: "other-bid", amount: 800 }]));         // activeBids

    const result = await placeBid({
      auctionId: UUID_1,
      riderId: UUID_2,
      amount: 300,
      round: 1,
    });

    expect(result).toEqual({ error: "Insufficient budget" });
  });

  it("returns error when current salaries + bids + new bid exceed treasury", async () => {
    // treasury = 1_000, salaries = 500, active bids = 300, new bid = 300 -> 1_100 > 1_000
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(makeChain({ league_id: "league-1", status: "open", closes_at: null }))
      .mockReturnValueOnce(makeChain({ id: "team-1", treasury: 1_000, phase_confirmed_id: 4 }))
      .mockReturnValueOnce(makeChain({ monthly_salary: 100 }))
      .mockReturnValueOnce(makeChain(null))
      .mockReturnValueOnce(makeChain([{ locked_salary: 500 }])) // current salaries
      .mockReturnValueOnce(makeChain([{ id: "other-bid", amount: 300 }])); // active bids

    const result = await placeBid({
      auctionId: UUID_1,
      riderId: UUID_2,
      amount: 300,
      round: 1,
    });

    expect(result).toEqual({ error: "Insufficient budget" });
  });

  it("allows bid when total exactly equals treasury", async () => {
    // treasury = 1_000, no other bids, new bid = 1_000 → 1_000 ≤ 1_000 → OK
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(makeChain({ league_id: "league-1", status: "open", closes_at: null }))                         // auctions
      .mockReturnValueOnce(makeChain({ id: "team-1", treasury: 1_000, level: 8, phase_confirmed_id: 4 }))   // teams
      .mockReturnValueOnce(makeChain({ monthly_salary: 100, pcs_rank: 5, ever_in_pool: true })) // riders
      .mockReturnValueOnce(makeChain(null))                               // existingBid
      .mockReturnValueOnce(makeChain([]))                                 // existing contracts
      .mockReturnValueOnce(makeChain([]))                                 // activeBids (empty)
      .mockReturnValueOnce(makeChain(null, null, 0))                     // contracts count (slot check)
      .mockReturnValueOnce(makeChain(null, null));                        // insert success

    const result = await placeBid({
      auctionId: UUID_1,
      riderId: UUID_2,
      amount: 1_000,
      round: 1,
    });

    expect(result).toEqual({ success: true });
  });
});

// ---------------------------------------------------------------------------
// cancelBid
// ---------------------------------------------------------------------------

describe("cancelBid", () => {
  it("rejects invalid UUID", async () => {
    const result = await cancelBid("not-a-uuid", UUID_2);
    expect(result).toEqual({ error: "Invalid data" });
  });

  it("rejects unauthenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await cancelBid(UUID_1, UUID_2);
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns success when all checks pass", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(makeChain({ id: UUID_1, team_id: "team-1", auction_id: UUID_2, status: "active", teams: { user_id: "user-1" } })) // bid lookup
      .mockReturnValueOnce(makeChain({ status: "open", closes_at: null })) // auction check
      .mockReturnValueOnce(makeChain(null, null)); // update

    const result = await cancelBid(UUID_1, UUID_2);
    expect(result).toEqual({ success: true });
  });

  it("rejects when bid not owned by user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(makeChain({ id: UUID_1, team_id: "team-1", auction_id: UUID_2, status: "active", teams: { user_id: "other-user" } }));

    const result = await cancelBid(UUID_1, UUID_2);
    expect(result).toEqual({ error: "Not authorized" });
  });

  it("rejects when bid is not active", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(makeChain({ id: UUID_1, team_id: "team-1", auction_id: UUID_2, status: "won", teams: { user_id: "user-1" } }));

    const result = await cancelBid(UUID_1, UUID_2);
    expect(result).toEqual({ error: "Bid is not active" });
  });

  it("rejects when auction is closed", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(makeChain({ id: UUID_1, team_id: "team-1", auction_id: UUID_2, status: "active", teams: { user_id: "user-1" } }))
      .mockReturnValueOnce(makeChain({ status: "closed", closes_at: null }));

    const result = await cancelBid(UUID_1, UUID_2);
    expect(result).toEqual({ error: "Auction is no longer open" });
  });
});
