import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockGetUser,
  mockAnonFrom,
  mockAdminFrom,
  mockGetCurrentPhase,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockAnonFrom: vi.fn(),
  mockAdminFrom: vi.fn(),
  mockGetCurrentPhase: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockAnonFrom,
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockAdminFrom,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/phases", () => ({
  getCurrentPhase: mockGetCurrentPhase,
}));

import { forceResolveRound } from "../actions";

// ---------------------------------------------------------------------------
// Test UUIDs (RFC-4122 v4)
// ---------------------------------------------------------------------------

const LEAGUE_ID = "cccccccc-0000-4000-8000-000000000001";
const USER_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const TEAM_A = "11111111-0000-4000-8000-000000000001";
const TEAM_B = "22222222-0000-4000-8000-000000000002";
const RIDER_X = "33333333-0000-4000-8000-000000000003";
const AUCTION_ID = "44444444-0000-4000-8000-000000000004";
const NEXT_AUCTION_ID = "55555555-0000-4000-8000-000000000005";

const PHASE_ID = 4; // Giro

// ---------------------------------------------------------------------------
// Shared chainable-query helper
// ---------------------------------------------------------------------------

interface QueryResult<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

/**
 * Build a chainable mock that matches Supabase's PostgREST query builder.
 * Each method returns `this` until a terminal method is called.
 *
 * Use `.terminate(result)` to set the resolved value of the final await.
 */
function chainable(result: QueryResult): unknown {
  const proxy: Record<string, unknown> = {};
  const passthroughs = [
    "select", "insert", "upsert", "update", "delete",
    "eq", "in", "lt", "gt", "is", "neq", "or",
    "order", "limit", "single", "maybeSingle",
  ];
  for (const m of passthroughs) {
    proxy[m] = vi.fn(() => proxy);
  }
  // `.then` makes the proxy thenable (resolves to the result) for `await`.
  proxy.then = (onFulfilled: (r: QueryResult) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return proxy;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("forceResolveRound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentPhase.mockReturnValue({ id: PHASE_ID, label: "Giro d'Italia" });
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  });

  it("rejects non-UUID leagueId", async () => {
    const result = await forceResolveRound({ leagueId: "not-a-uuid" });
    expect(result).toMatchObject({ error: expect.any(String) });
  });

  it("rejects unauthenticated callers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await forceResolveRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({ error: expect.stringMatching(/auth/i) });
  });

  it("rejects callers who are not members of the league", async () => {
    // First chained query (league membership check) returns null
    mockAnonFrom.mockReturnValueOnce(
      chainable({ data: null, error: null })
    );
    const result = await forceResolveRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({ error: expect.stringMatching(/member/i) });
  });

  it("returns error if no open auction exists", async () => {
    // Membership check passes
    mockAnonFrom.mockReturnValueOnce(
      chainable({ data: { team_id: TEAM_A }, error: null })
    );
    // Optimistic lock: UPDATE auctions SET status='closed' WHERE status='open' returns 0 rows
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: [], error: null })
    );
    const result = await forceResolveRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({
      error: expect.stringMatching(/no open round/i),
    });
  });

  it("ports Python: highest bid wins, losers marked outbid", async () => {
    // 1. Membership check
    mockAnonFrom.mockReturnValueOnce(
      chainable({ data: { team_id: TEAM_A }, error: null })
    );
    // 2. Optimistic lock + return locked auction
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [{ id: AUCTION_ID, name: "Round 2", league_id: LEAGUE_ID }],
        error: null,
      })
    );
    // 3. Fetch active bids
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [
          {
            id: "bid-a",
            rider_id: RIDER_X,
            team_id: TEAM_A,
            amount: 12_000,
            placed_at: "2026-05-08T10:00:00Z",
          },
          {
            id: "bid-b",
            rider_id: RIDER_X,
            team_id: TEAM_B,
            amount: 10_000,
            placed_at: "2026-05-08T09:00:00Z",
          },
        ],
        error: null,
      })
    );
    // 4. Fetch rider for level gating
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: { id: RIDER_X, full_name: "Test Rider", pcs_rank: 50 },
        error: null,
      })
    );
    // 5. Fetch team for level gating
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { id: TEAM_A, level: 4, treasury: 100_000 }, error: null })
    );
    // 6. Existing-contract check (none)
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: null, error: null })
    );
    // 7. UPDATE winner bid
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 8. UPDATE loser bids
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 9. INSERT contract
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 10. UPDATE rider is_active_in_game
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 11. UPDATE team treasury (Round 2+)
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 12. INSERT treasury_log
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 13. Cleanup: SELECT contracts (returns the new contract for RIDER_X)
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: [{ rider_id: RIDER_X }], error: null })
    );
    // 14. Cleanup: DELETE draft_bids
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 15. Find next scheduled auction
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { id: NEXT_AUCTION_ID }, error: null })
    );
    // 16. UPDATE next auction → open
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));

    const result = await forceResolveRound({ leagueId: LEAGUE_ID });

    expect(result).toMatchObject({
      ok: true,
      resolved: 1,
      next_auction_id: NEXT_AUCTION_ID,
    });
  });

  it("Round 1 skips treasury deduction", async () => {
    // 1. Membership check
    mockAnonFrom.mockReturnValueOnce(
      chainable({ data: { team_id: TEAM_A }, error: null })
    );
    // 2. Optimistic lock returns Round 1 auction
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [{ id: AUCTION_ID, name: "Round 1", league_id: LEAGUE_ID }],
        error: null,
      })
    );
    // 3. Active bids: one rider, one bidder
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [
          {
            id: "bid-a",
            rider_id: RIDER_X,
            team_id: TEAM_A,
            amount: 12_000,
            placed_at: "2026-05-08T10:00:00Z",
          },
        ],
        error: null,
      })
    );
    // 4. Rider
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: { id: RIDER_X, full_name: "Test Rider", pcs_rank: 50 },
        error: null,
      })
    );
    // 5. Team
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { id: TEAM_A, level: 4, treasury: 100_000 }, error: null })
    );
    // 6. Contract check
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 7. Mark winner won
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // (No losers in this test → guard skips the losers update mock entirely)
    // 8. INSERT contract
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 9. Update rider
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // ROUND 1: no treasury update, no treasury_log insert
    // 10. Cleanup: SELECT contracts (returns the new contract for RIDER_X)
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: [{ rider_id: RIDER_X }], error: null })
    );
    // 11. Cleanup: DELETE draft_bids
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 12. Find next scheduled auction (none — last round)
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));

    const result = await forceResolveRound({ leagueId: LEAGUE_ID });

    expect(result).toMatchObject({ ok: true, resolved: 1 });
  });

  it("level-gated rider has all bids cancelled, no contract", async () => {
    mockAnonFrom.mockReturnValueOnce(
      chainable({ data: { team_id: TEAM_A }, error: null })
    );
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [{ id: AUCTION_ID, name: "Round 2", league_id: LEAGUE_ID }],
        error: null,
      })
    );
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [
          {
            id: "bid-a",
            rider_id: RIDER_X,
            team_id: TEAM_A,
            amount: 12_000,
            placed_at: "2026-05-08T10:00:00Z",
          },
        ],
        error: null,
      })
    );
    // Rider has pcs_rank=2 (very high); team is level 1 → poolMin=300 → BLOCKED
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: { id: RIDER_X, full_name: "Top Rider", pcs_rank: 2 },
        error: null,
      })
    );
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { id: TEAM_A, level: 1, treasury: 100_000 }, error: null })
    );
    // Cancel all bids for this rider (level-gated)
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // Cleanup: SELECT contracts (no contracts → no DELETE)
    mockAdminFrom.mockReturnValueOnce(chainable({ data: [], error: null }));
    // Find next scheduled auction
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));

    const result = await forceResolveRound({ leagueId: LEAGUE_ID });

    expect(result).toMatchObject({ ok: true, resolved: 0 });
  });

  it("rider with existing contract has all bids cancelled", async () => {
    mockAnonFrom.mockReturnValueOnce(
      chainable({ data: { team_id: TEAM_A }, error: null })
    );
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [{ id: AUCTION_ID, name: "Round 2", league_id: LEAGUE_ID }],
        error: null,
      })
    );
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [
          {
            id: "bid-a",
            rider_id: RIDER_X,
            team_id: TEAM_A,
            amount: 12_000,
            placed_at: "2026-05-08T10:00:00Z",
          },
        ],
        error: null,
      })
    );
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: { id: RIDER_X, full_name: "Test", pcs_rank: 50 },
        error: null,
      })
    );
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { id: TEAM_A, level: 4, treasury: 100_000 }, error: null })
    );
    // Existing contract found
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { id: "existing-contract" }, error: null })
    );
    // Cancel all bids
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // Cleanup: SELECT contracts (the existing contract is still active in this league)
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: [{ rider_id: RIDER_X }], error: null })
    );
    // Cleanup: DELETE draft_bids
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // Find next scheduled auction
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));

    const result = await forceResolveRound({ leagueId: LEAGUE_ID });

    expect(result).toMatchObject({ ok: true, resolved: 0 });
  });
});
