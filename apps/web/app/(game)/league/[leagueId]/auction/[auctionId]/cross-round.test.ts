/**
 * Cross-round solvency regression test.
 *
 * Bug: placeBid filtered active bids by round (.eq("round", …)), allowing a
 * user to spread bids across multiple rounds and bypass the treasury check.
 *
 * Fix: remove the round filter so ALL active bids for this auction are summed.
 *
 * Mock strategy:
 *   The activeBids query is the 6th `from()` call (0-indexed: index 5).
 *   We use a custom from() mock that returns round-aware data for that specific
 *   query: if `.eq("round", …)` is called on it, the chain returns an empty
 *   array (simulating round-filtered result that hides cross-round bids).
 *   If `.eq("round", …)` is NOT called, it returns the full cross-round list.
 *   This is exactly what the real Supabase query does.
 */

import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — declared before any imports
// ---------------------------------------------------------------------------

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

import { placeBid } from "./actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID_AUCTION = "550e8400-e29b-41d4-a716-446655440010";
const UUID_RIDER_B = "550e8400-e29b-41d4-a716-446655440012";

/**
 * Standard chain: every builder method returns the same chain object.
 * Awaiting resolves to { data, error, count }.
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

/**
 * Round-aware chain for the activeBids query.
 *
 * If `.eq("round", …)` is called on this chain, the chain switches to
 * returning `roundFilteredData` (mimicking the buggy filtered result).
 * Otherwise it returns `allRoundsData` (mimicking the fixed unfiltered result).
 *
 * This lets the same test scenario fail against the buggy code and pass
 * against the fixed code.
 */
function makeRoundAwareChain(
  allRoundsData: unknown,
  roundFilteredData: unknown,
) {
  let hasRoundFilter = false;

  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => {
      const data = hasRoundFilter ? roundFilteredData : allRoundsData;
      return Promise.resolve({ data, error: null, count: null }).then(resolve);
    },
    catch: (reject: (v: unknown) => unknown) =>
      Promise.resolve({ data: allRoundsData, error: null, count: null }).catch(reject),
    finally: (cb: () => void) =>
      Promise.resolve({ data: allRoundsData, error: null, count: null }).finally(cb),
  };

  for (const m of [
    "select", "neq", "gt", "gte", "lt", "lte", "in",
    "single", "maybeSingle", "update", "insert", "upsert",
  ]) {
    chain[m] = () => chain;
  }

  // Override eq to detect the round filter. The Supabase client passes
  // (column, value) — we keep the second arg in the signature so the
  // chain stays compatible if a test ever wants to inspect it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  chain["eq"] = (col: unknown, _val: unknown) => {
    if (col === "round") {
      hasRoundFilter = true;
    }
    return chain;
  };

  return chain;
}

// ---------------------------------------------------------------------------
// Cross-round solvency tests
// ---------------------------------------------------------------------------

describe("placeBid — cross-round solvency", () => {
  it("rejects a bid in round 2 when combined with a round-1 bid it would exceed treasury", async () => {
    /**
     * Setup:
     *   treasury      = 200_000
     *   contracts     = [] (no ongoing salaries)
     *   active bids   = [{ id: "bid-r1", amount: 150_000 }] across all rounds
     *   new bid       = 100_000 in round 2
     *   total if placed = 150_000 + 100_000 = 250_000 > 200_000  → must be rejected
     *
     * Buggy behaviour (before fix):
     *   The activeBids query has .eq("round", 2) → returns [] (no bids in round 2)
     *   → total check sees 0 + 100_000 ≤ 200_000 → incorrectly allows the bid
     *
     * Fixed behaviour (after fix):
     *   The activeBids query has no round filter → returns [{ amount: 150_000 }]
     *   → total check sees 150_000 + 100_000 > 200_000 → correctly rejects the bid
     */
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockFrom
      // 1. auctions — open, not expired
      .mockReturnValueOnce(makeChain({ league_id: "league-1", status: "open", closes_at: null }))
      // 2. teams — 200k treasury
      .mockReturnValueOnce(makeChain({ id: "team-1", treasury: 200_000, level: 4 }))
      // 3. riders — salary below bid amount, pool-eligible
      .mockReturnValueOnce(makeChain({ monthly_salary: 5_000, pcs_rank: 50, ever_in_top500: true }))
      // 4. existingBid (maybeSingle) — no prior bid for this rider in round 2
      .mockReturnValueOnce(makeChain(null))
      // 5. existing contracts — none
      .mockReturnValueOnce(makeChain([]))
      // 6. activeBids — round-aware:
      //    - if buggy code applies .eq("round", 2): returns [] (round 1 bid invisible)
      //    - if fixed code omits round filter:       returns [{ amount: 150_000 }]
      .mockReturnValueOnce(
        makeRoundAwareChain(
          [{ id: "bid-r1", amount: 150_000 }], // all rounds (fixed)
          [],                                   // round-filtered (buggy)
        ),
      );

    const result = await placeBid({
      auctionId: UUID_AUCTION,
      riderId: UUID_RIDER_B,
      amount: 100_000,
      round: 2,
    });

    // Must be rejected due to 150k + 100k > 200k
    expect(result.error).toMatch(/[Ii]nsufficient/);
  });

  it("allows a bid in round 2 when combined with round-1 bid it stays within treasury", async () => {
    /**
     * Setup:
     *   treasury      = 200_000
     *   contracts     = []
     *   active bids   = [{ id: "bid-r1", amount: 80_000 }]  ← round 1
     *   new bid       = 100_000 in round 2
     *   total if placed = 80_000 + 100_000 = 180_000 ≤ 200_000  → must be allowed
     */
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockFrom
      // 1. auctions
      .mockReturnValueOnce(makeChain({ league_id: "league-1", status: "open", closes_at: null }))
      // 2. teams
      .mockReturnValueOnce(makeChain({ id: "team-1", treasury: 200_000, level: 4 }))
      // 3. riders
      .mockReturnValueOnce(makeChain({ monthly_salary: 5_000, pcs_rank: 50, ever_in_top500: true }))
      // 4. existingBid — none
      .mockReturnValueOnce(makeChain(null))
      // 5. existing contracts — none
      .mockReturnValueOnce(makeChain([]))
      // 6. activeBids — 80k from round 1 (well within treasury)
      .mockReturnValueOnce(makeChain([{ id: "bid-r1", amount: 80_000 }]))
      // 7. co-unlock: fetchLeagueTeamLevels
      .mockReturnValueOnce(makeChain([{ level: 4 }, { level: 4 }]))
      // 8. contracts count (slot check)
      .mockReturnValueOnce(makeChain(null, null, 0))
      // 9. insert — success
      .mockReturnValueOnce(makeChain(null, null));

    const result = await placeBid({
      auctionId: UUID_AUCTION,
      riderId: UUID_RIDER_B,
      amount: 100_000,
      round: 2,
    });

    expect(result).toEqual({ success: true });
  });
});
