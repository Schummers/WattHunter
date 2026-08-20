import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockGetUser,
  mockAnonFrom,
  mockAdminFrom,
  mockAdminRpc,
  mockGetCurrentPhase,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockAnonFrom: vi.fn(),
  mockAdminFrom: vi.fn(),
  mockAdminRpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
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
    rpc: mockAdminRpc,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/phases", () => ({
  getCurrentPhase: mockGetCurrentPhase,
  getPhaseRange: () => ({ start: new Date("2026-05-02"), end: new Date("2026-06-01") }),
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
    // (Treasury is NOT mutated at resolution — handled by payday RPC)
    // 11. Cleanup: SELECT contracts (returns the new contract for RIDER_X)
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: [{ rider_id: RIDER_X }], error: null })
    );
    // 12. Cleanup: DELETE draft_bids
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 13. Find next scheduled auction
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { id: NEXT_AUCTION_ID }, error: null })
    );
    // 14. UPDATE next auction → open
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));

    const result = await forceResolveRound({ leagueId: LEAGUE_ID });

    expect(result).toMatchObject({
      ok: true,
      resolved: 1,
      next_auction_id: NEXT_AUCTION_ID,
    });
  });

  it("resolution does not deduct treasury (deferred to payday)", async () => {
    // Regression test for the R2/R3 double-counting bug. Treasury must NOT be
    // mutated at auction resolution for any round — payday (confirm_phase_setup)
    // is the single source of truth for salary deduction. Deducting here would
    // double-count against the purchasing power formula
    // (treasury + sponsor − active_salaries).
    //
    // We exercise Round 2 here (the round that was historically buggy);
    // Round 1 has always skipped treasury and remains unchanged.

    // 1. Membership check
    mockAnonFrom.mockReturnValueOnce(
      chainable({ data: { team_id: TEAM_A }, error: null })
    );
    // 2. Optimistic lock returns Round 2 auction
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [{ id: AUCTION_ID, name: "Round 2", league_id: LEAGUE_ID }],
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
    // (No treasury UPDATE, no treasury_log INSERT — even for Round 2)
    // 10. Cleanup: SELECT contracts (returns the new contract for RIDER_X)
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: [{ rider_id: RIDER_X }], error: null })
    );
    // 11. Cleanup: DELETE draft_bids
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 12. Find next scheduled auction (next round exists)
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { id: NEXT_AUCTION_ID }, error: null })
    );
    // 13. UPDATE next auction → open
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));

    const result = await forceResolveRound({ leagueId: LEAGUE_ID });

    expect(result).toMatchObject({ ok: true, resolved: 1, next_auction_id: NEXT_AUCTION_ID });

    // Sanity: total mockAdminFrom calls should be 12. If the bug returns
    // (treasury UPDATE + treasury_log INSERT), this would jump to 14.
    expect(mockAdminFrom).toHaveBeenCalledTimes(12);
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
    // Find next scheduled auction (next round exists)
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { id: NEXT_AUCTION_ID }, error: null })
    );
    // UPDATE next auction → open
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));

    const result = await forceResolveRound({ leagueId: LEAGUE_ID });

    expect(result).toMatchObject({ ok: true, resolved: 0, next_auction_id: NEXT_AUCTION_ID });
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
    // Find next scheduled auction (next round exists)
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { id: NEXT_AUCTION_ID }, error: null })
    );
    // UPDATE next auction → open
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));

    const result = await forceResolveRound({ leagueId: LEAGUE_ID });

    expect(result).toMatchObject({ ok: true, resolved: 0, next_auction_id: NEXT_AUCTION_ID });
  });

  it("closes the remaining rounds instead of opening one when every squad is full", async () => {
    mockGetCurrentPhase.mockReturnValue({ id: PHASE_ID, label: "Giro d'Italia", startMonth: 5, startDay: 2 });

    // 1. Membership check
    mockAnonFrom.mockReturnValueOnce(
      chainable({ data: { team_id: TEAM_A }, error: null })
    );
    // 2. Optimistic lock
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [{ id: AUCTION_ID, name: "Round 3", league_id: LEAGUE_ID }],
        error: null,
      })
    );
    // 3. Active bids: empty
    mockAdminFrom.mockReturnValueOnce(chainable({ data: [], error: null }));
    // 4. Cleanup: SELECT contracts (empty)
    mockAdminFrom.mockReturnValueOnce(chainable({ data: [], error: null }));
    // 5. A next scheduled round DOES exist...
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { id: NEXT_AUCTION_ID }, error: null })
    );
    // 6. ...but every squad is full, so the leftovers get closed instead
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 7. SELECT leagues.mode for the payday cascade
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { mode: "classic" }, error: null })
    );
    // 8. league_members + 9. teams
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: [{ team_id: TEAM_A }], error: null })
    );
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: [{ id: TEAM_A, name: "Alpha" }], error: null })
    );

    // RPC 1: submit_conforming_drafts
    mockAdminRpc.mockResolvedValueOnce({ data: 0, error: null });
    // RPC 2: league_all_teams_complete → true
    mockAdminRpc.mockResolvedValueOnce({ data: true, error: null });
    // RPC 3: classic_phase_reset
    mockAdminRpc.mockResolvedValueOnce({
      data: { ok: true, skipped: false },
      error: null,
    });

    const result = await forceResolveRound({ leagueId: LEAGUE_ID });

    // The next round was never opened: the phase ended instead.
    expect(result).toMatchObject({ ok: true, next_auction_id: null });
    expect(mockAdminRpc).toHaveBeenCalledWith("league_all_teams_complete", {
      p_league_id: LEAGUE_ID,
    });
    expect(result).toHaveProperty("payday");
  });

  it("triggers payday cascade when last round of phase closes", async () => {
    mockGetCurrentPhase.mockReturnValue({ id: PHASE_ID, label: "Giro d'Italia", startMonth: 5, startDay: 2 });

    // 1. Membership check
    mockAnonFrom.mockReturnValueOnce(
      chainable({ data: { team_id: TEAM_A }, error: null })
    );
    // 2. Optimistic lock returns Round 3 auction
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [{ id: AUCTION_ID, name: "Round 3", league_id: LEAGUE_ID }],
        error: null,
      })
    );
    // 3. Active bids: empty (no winners)
    mockAdminFrom.mockReturnValueOnce(chainable({ data: [], error: null }));
    // 4. Cleanup: SELECT contracts (empty)
    mockAdminFrom.mockReturnValueOnce(chainable({ data: [], error: null }));
    // 5. Find next scheduled auction → null (last round)
    mockAdminFrom.mockReturnValueOnce(chainable({ data: null, error: null }));
    // 6. SELECT leagues.mode for cascade routing
    mockAdminFrom.mockReturnValueOnce(
      chainable({ data: { mode: "manager" }, error: null })
    );
    // 7. SELECT league_members for cascade
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [
          { team_id: TEAM_A },
          { team_id: TEAM_B },
        ],
        error: null,
      })
    );
    // 8. SELECT teams for cascade
    mockAdminFrom.mockReturnValueOnce(
      chainable({
        data: [
          { id: TEAM_A, name: "Alpha" },
          { id: TEAM_B, name: "Beta" },
        ],
        error: null,
      })
    );

    // RPC 1: submit_conforming_drafts (runs right after the optimistic lock)
    mockAdminRpc.mockResolvedValueOnce({ data: 0, error: null });
    // RPC 2-3: confirm_phase_setup × 2 (one per team)
    mockAdminRpc.mockResolvedValueOnce({
      data: { ok: true, skippedLateJoiner: false, sponsorIncome: 750000, totalSalary: 600000 },
      error: null,
    });
    mockAdminRpc.mockResolvedValueOnce({
      data: { ok: true, skippedLateJoiner: true },
      error: null,
    });

    const result = await forceResolveRound({ leagueId: LEAGUE_ID });

    expect(result).toMatchObject({
      ok: true,
      resolved: 0,
      next_auction_id: null,
      payday: { paid: 1, skippedLateJoiners: 1, errors: [] },
    });
    expect(mockAdminRpc).toHaveBeenCalledTimes(3);
    expect(mockAdminRpc).toHaveBeenCalledWith("submit_conforming_drafts", {
      p_auction_id: AUCTION_ID,
      p_league_id: LEAGUE_ID,
    });
    expect(mockAdminRpc).toHaveBeenCalledWith("confirm_phase_setup", expect.objectContaining({
      p_team_id: TEAM_A,
      p_current_phase_id: PHASE_ID,
    }));
  });
});
