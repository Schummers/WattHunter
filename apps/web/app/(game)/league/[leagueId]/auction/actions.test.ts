import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that consume them.
// ---------------------------------------------------------------------------

const { mockFrom, mockGetUser, mockGetCurrentPhase, mockRpc, mockAdminFrom, mockAdminRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetCurrentPhase: vi.fn(),
  mockRpc: vi.fn(),
  mockAdminFrom: vi.fn(),
  mockAdminRpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
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

// NOTE: lib/budget.ts and lib/levels.ts are pure functions — intentionally NOT mocked.

import { validateRound } from "./actions";
import { phaseResetRpcFor } from "@/lib/league-mode";

// ---------------------------------------------------------------------------
// Test UUIDs (RFC-4122 v4: version nibble = 4, variant nibble = 8)
// ---------------------------------------------------------------------------

const LEAGUE_ID = "cccccccc-0000-4000-8000-000000000001";
const AUCTION_ID = "aaaaaaaa-0000-4000-8000-000000000001";

const USER_ID = "dddddddd-0000-4000-8000-000000000001";
const TEAM_ID = "eeeeeeee-0000-4000-8000-000000000001";
const CURRENT_PHASE_ID = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default mockFrom that returns null auction (no consensus check triggers). */
function setupDefaultFrom() {
  mockFrom.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          limit: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    }),
  }));
}

/** Configure mockFrom for consensus queries with specific counts. */
function setupConsensusFrom(opts: {
  auctionId: string | null;
  validatedCount: number;
  memberCount: number;
}) {
  let leagueMemberCallCount = 0;
  mockFrom.mockImplementation((table: string) => {
    if (table === "auctions") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: opts.auctionId ? { id: opts.auctionId } : null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "round_validations") {
      return {
        select: () => ({
          eq: () => ({ count: opts.validatedCount, error: null }),
        }),
      };
    }
    if (table === "league_members") {
      leagueMemberCallCount++;
      if (leagueMemberCallCount === 1) {
        // First call: consensus count check (head: true)
        return {
          select: () => ({
            eq: () => ({ count: opts.memberCount, error: null }),
          }),
        };
      }
      // Second call: forceResolveRound membership check (.select("team_id").eq().eq().maybeSingle())
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { team_id: TEAM_ID },
                error: null,
              }),
            }),
          }),
        }),
      };
    }
    return { select: () => ({ eq: () => ({}) }) };
  });
}

/**
 * Mock the admin client chain for forceResolveRound.
 * Simulates: lock auction (update→select), fetch bids, open next auction, etc.
 * For consensus tests we only need the lock step to succeed or fail.
 */
function setupAdminForResolve(opts: { lockSucceeds: boolean }) {
  mockAdminFrom.mockImplementation((table: string) => {
    if (table === "auctions") {
      return {
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: async () => ({
                data: opts.lockSucceeds
                  ? [{ id: AUCTION_ID, name: "Giro Round 1", league_id: LEAGUE_ID }]
                  : [],
                error: null,
              }),
            }),
          }),
        }),
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: { id: "next-auction-4000-8000-000000000099" },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "auction_bids") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => async () => ({ data: [], error: null }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => async () => ({ error: null }),
            }),
          }),
        }),
      };
    }
    if (table === "contracts") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => async () => ({ data: [], error: null }),
          }),
        }),
      };
    }
    return {
      select: () => ({ eq: () => ({ eq: () => async () => ({ data: [], error: null }) }) }),
      delete: () => ({ eq: () => ({ in: () => async () => ({ error: null }) }) }),
    };
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("phaseResetRpcFor", () => {
  it("routes classic leagues to classic_phase_reset", () => {
    expect(phaseResetRpcFor("classic")).toBe("classic_phase_reset");
  });
  it("routes manager leagues to confirm_phase_setup", () => {
    expect(phaseResetRpcFor("manager")).toBe("confirm_phase_setup");
  });
});

describe("validateRound (via RPC)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentPhase.mockReturnValue({ id: CURRENT_PHASE_ID, label: "Classics Part 2" });
    setupDefaultFrom();
  });

  // -------------------------------------------------------------------------
  // 1. Zod validation
  // -------------------------------------------------------------------------

  it("rejects non-UUID leagueId", async () => {
    const result = await validateRound({ leagueId: "not-a-uuid" });
    expect(result).toMatchObject({ error: expect.any(String) });
  });

  // -------------------------------------------------------------------------
  // 2. RPC error forwarding — auth, team, budget, slots, etc.
  // -------------------------------------------------------------------------

  it("forwards RPC auth error", async () => {
    mockRpc.mockResolvedValueOnce({ data: { error: "Not authenticated" }, error: null });
    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("forwards RPC team-not-found error", async () => {
    mockRpc.mockResolvedValueOnce({ data: { error: "Team not found" }, error: null });
    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toEqual({ error: "Team not found" });
  });

  it("forwards RPC no-open-auction error", async () => {
    mockRpc.mockResolvedValueOnce({ data: { error: "No open auction round found" }, error: null });
    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toEqual({ error: "No open auction round found" });
  });

  it("forwards RPC budget error", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { error: "Budget exceeded: you cannot afford 500000 € of drafts with your current purchasing power." },
      error: null,
    });
    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({ error: expect.stringMatching(/budget/i) });
  });

  it("forwards RPC slot error", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { error: "Roster limit exceeded: 5 active + 2 new bids = 7 riders, but your level allows 6 slots" },
      error: null,
    });
    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({ error: expect.stringMatching(/[Rr]oster|[Ss]lot/) });
  });

  // -------------------------------------------------------------------------
  // 3. Postgres-level error (e.g. connection lost)
  // -------------------------------------------------------------------------

  it("forwards Supabase-level error", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "DB connection lost" } });
    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toEqual({ error: "DB connection lost" });
  });

  // -------------------------------------------------------------------------
  // 4. Happy path (no consensus — auction query returns null)
  // -------------------------------------------------------------------------

  it("returns success when RPC confirms round validation", async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true, inserted: 2 }, error: null });
    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toEqual({ success: true });
  });

  it("returns success for empty drafts (idempotent re-validation)", async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true, inserted: 0 }, error: null });
    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toEqual({ success: true });
  });

  // -------------------------------------------------------------------------
  // 5. Passes current phase id to RPC
  // -------------------------------------------------------------------------

  it("passes getCurrentPhase().id as p_current_phase_id", async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true, inserted: 1 }, error: null });
    await validateRound({ leagueId: LEAGUE_ID });

    expect(mockRpc).toHaveBeenCalledWith("validate_round", {
      p_league_id: LEAGUE_ID,
      p_current_phase_id: CURRENT_PHASE_ID,
    });
  });

  // -------------------------------------------------------------------------
  // 6. Auto-resolve on consensus
  // -------------------------------------------------------------------------

  describe("auto-resolve on consensus", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    });

    it("auto-resolves when all members have validated", async () => {
      mockRpc.mockResolvedValueOnce({ data: { ok: true, inserted: 2 }, error: null });
      setupConsensusFrom({ auctionId: AUCTION_ID, validatedCount: 4, memberCount: 4 });
      setupAdminForResolve({ lockSucceeds: true });

      const result = await validateRound({ leagueId: LEAGUE_ID });

      expect(result).toEqual({ success: true, resolved: true });
    });

    it("does NOT auto-resolve when not all members validated", async () => {
      mockRpc.mockResolvedValueOnce({ data: { ok: true, inserted: 1 }, error: null });
      setupConsensusFrom({ auctionId: AUCTION_ID, validatedCount: 2, memberCount: 4 });

      const result = await validateRound({ leagueId: LEAGUE_ID });

      expect(result).toEqual({ success: true });
      expect(result).not.toHaveProperty("resolved");
    });

    it("returns success even if resolve fails (concurrent resolve)", async () => {
      mockRpc.mockResolvedValueOnce({ data: { ok: true, inserted: 1 }, error: null });
      setupConsensusFrom({ auctionId: AUCTION_ID, validatedCount: 3, memberCount: 3 });
      setupAdminForResolve({ lockSucceeds: false });

      const result = await validateRound({ leagueId: LEAGUE_ID });

      expect(result).toEqual({ success: true });
    });
  });
});
