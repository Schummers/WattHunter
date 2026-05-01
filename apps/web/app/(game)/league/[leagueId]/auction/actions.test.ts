import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  installSequence as sharedInstallSequence,
  loggedInUser,
  noAuthUser,
} from "@/test-utils/supabase-mock";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that consume them.
// ---------------------------------------------------------------------------

const { mockFrom, mockGetUser, mockGetCurrentPhase } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetCurrentPhase: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/phases", () => ({
  getCurrentPhase: mockGetCurrentPhase,
}));

// NOTE: lib/budget.ts and lib/levels.ts are pure functions — intentionally NOT mocked.

import { validateRound } from "./actions";

// ---------------------------------------------------------------------------
// Test UUIDs (RFC-4122 v4: version nibble = 4, variant nibble = 8)
// ---------------------------------------------------------------------------

const USER_ID   = "aaaaaaaa-0000-4000-8000-000000000001";
const TEAM_ID   = "bbbbbbbb-0000-4000-8000-000000000001";
const LEAGUE_ID = "cccccccc-0000-4000-8000-000000000001";
const AUCTION_ID = "dddddddd-0000-4000-8000-000000000001";
const RIDER_ID_1 = "eeeeeeee-0000-4000-8000-000000000001";
const RIDER_ID_2 = "eeeeeeee-0000-4000-8000-000000000002";
const CONTRACT_ID_1 = "ffffffff-0000-4000-8000-000000000001";

// Current phase id used in budget branching
const CURRENT_PHASE_ID = 3;

// ---------------------------------------------------------------------------
// Reusable fixtures
// ---------------------------------------------------------------------------

/** A team at level 1 (6 slots) with a healthy treasury. */
function teamRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TEAM_ID,
    treasury: 200_000,
    level: 1,
    phase_confirmed_id: null, // not yet confirmed → pre-payday formula
    ...overrides,
  };
}

/** An open auction named "Round 1" (extracts round number 1). */
function auctionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: AUCTION_ID,
    name: "Round 1",
    ...overrides,
  };
}

/** Sponsor row (monthly_budget 250_000). */
const sponsorRow = { sponsors: { monthly_budget: 250_000 } };

/** Local wrapper over shared installSequence — bound to this file's mockFrom. */
function installSequence(steps: Array<{ table: string; data?: unknown; error?: unknown }>) {
  return sharedInstallSequence(mockFrom, steps);
}

/**
 * Full happy-path sequence for validateRound.
 * Parameters let tests tweak individual layers without repeating every step.
 */
function happyPathSequence({
  team = teamRow(),
  drafts = [
    { id: "dddddddd-0000-4000-8000-000000000010", rider_id: RIDER_ID_1, amount: 10_000 },
    { id: "dddddddd-0000-4000-8000-000000000011", rider_id: RIDER_ID_2, amount: 10_000 },
  ],
  contracts = [] as Array<{ id: string; locked_salary: number }>,
  sponsor: sponsorData = sponsorRow as unknown,
} = {}) {
  return installSequence([
    { table: "league_members",  data: { team_id: TEAM_ID } },   // getTeamForUser
    { table: "teams",           data: team },
    { table: "auctions",        data: auctionRow() },
    { table: "draft_bids",      data: drafts },
    { table: "contracts",       data: contracts },
    { table: "team_sponsors",   data: sponsorData },
    { table: "auction_bids",    data: null },                   // update → cancel old
    { table: "auction_bids",    data: null },                   // insert new bids
  ]);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("validateRound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: logged-in user
    mockGetUser.mockResolvedValue(loggedInUser(USER_ID));
    // Default: current phase id = 3 (not confirmed → pre-payday)
    mockGetCurrentPhase.mockReturnValue({ id: CURRENT_PHASE_ID, label: "Classics Part 2" });
  });

  // -------------------------------------------------------------------------
  // 1. Auth missing
  // -------------------------------------------------------------------------

  it("returns error when the user is not authenticated", async () => {
    mockGetUser.mockResolvedValue(noAuthUser);
    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({ error: expect.any(String) });
  });

  // -------------------------------------------------------------------------
  // 2. Team not found / not a member
  // -------------------------------------------------------------------------

  it("returns error when the user has no team in the league", async () => {
    installSequence([
      { table: "league_members", data: null }, // no membership row
    ]);
    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({ error: expect.any(String) });
  });

  it("returns error when the team row itself is missing", async () => {
    installSequence([
      { table: "league_members", data: { team_id: TEAM_ID } },
      { table: "teams",          data: null }, // team record absent
    ]);
    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({ error: expect.any(String) });
  });

  // -------------------------------------------------------------------------
  // 3. Happy path — 2 drafts within budget and slots
  // -------------------------------------------------------------------------

  it("returns { success: true }, cancels old bids, inserts 2 new bids", async () => {
    const { recordedUpdates, recordedInserts } = happyPathSequence();

    const result = await validateRound({ leagueId: LEAGUE_ID });

    expect(result).toEqual({ success: true });

    // Previous active bids must be cancelled
    expect(recordedUpdates["auction_bids"]).toHaveLength(1);
    expect(recordedUpdates["auction_bids"][0]).toMatchObject({ status: "cancelled" });

    // Two new auction_bids inserted
    const inserts = recordedInserts["auction_bids"] as Array<unknown[]>;
    expect(inserts).toHaveLength(1); // single insert call with an array
    const bids = inserts[0] as Array<{ rider_id: string; amount: number; status: string }>;
    expect(bids).toHaveLength(2);
    expect(bids[0]).toMatchObject({ rider_id: RIDER_ID_1, amount: 10_000, status: "active" });
    expect(bids[1]).toMatchObject({ rider_id: RIDER_ID_2, amount: 10_000, status: "active" });
  });

  // -------------------------------------------------------------------------
  // 4. Budget exceeded
  // -------------------------------------------------------------------------

  it("returns budget error when total drafts exceed purchasing power (pre-payday)", async () => {
    // treasury=200_000, sponsor=250_000, activeSalaries=0
    // pre-payday available = 200_000 + 250_000 - 0 - draftTotal
    // draftTotal = 500_000 → remaining = -50_000 → reject
    installSequence([
      { table: "league_members", data: { team_id: TEAM_ID } },
      { table: "teams",          data: teamRow({ treasury: 200_000 }) },
      { table: "auctions",       data: auctionRow() },
      {
        table: "draft_bids",
        data: [
          { id: "dddddddd-0000-4000-8000-000000000010", rider_id: RIDER_ID_1, amount: 300_000 },
          { id: "dddddddd-0000-4000-8000-000000000011", rider_id: RIDER_ID_2, amount: 200_000 },
        ],
      },
      { table: "contracts",    data: [] },
      { table: "team_sponsors", data: sponsorRow },
      // No auction_bids step — action must return before writing
    ]);

    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({ error: expect.stringMatching(/budget/i) });
  });

  it("returns budget error when active salaries eat into purchasing power", async () => {
    // treasury=200_000, sponsor=250_000, activeSalaries=400_000
    // pre-payday available = 200_000 + 250_000 - 400_000 - 50_000 = 0 → passes
    // BUT with 50_001 draft it goes negative → reject
    installSequence([
      { table: "league_members", data: { team_id: TEAM_ID } },
      { table: "teams",          data: teamRow({ treasury: 200_000 }) },
      { table: "auctions",       data: auctionRow() },
      {
        table: "draft_bids",
        data: [
          { id: "dddddddd-0000-4000-8000-000000000010", rider_id: RIDER_ID_1, amount: 50_100 },
        ],
      },
      {
        table: "contracts",
        data: [{ id: CONTRACT_ID_1, locked_salary: 400_000 }],
      },
      { table: "team_sponsors", data: sponsorRow },
      // No auction_bids step expected
    ]);

    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({ error: expect.stringMatching(/budget/i) });
  });

  // -------------------------------------------------------------------------
  // 5. Roster slot overflow
  // -------------------------------------------------------------------------

  it("returns slot error when active + draft bids exceed level-1 max (6 slots)", async () => {
    // Level 1 → max 6 slots
    // 5 existing contracts + 2 draft bids = 7 > 6 → reject
    const existingContracts = Array.from({ length: 5 }, (_, i) => ({
      id: `ffffffff-0000-4000-8000-00000000000${i + 1}`,
      locked_salary: 5_000,
    }));

    installSequence([
      { table: "league_members", data: { team_id: TEAM_ID } },
      { table: "teams",          data: teamRow({ level: 1 }) },
      { table: "auctions",       data: auctionRow() },
      {
        table: "draft_bids",
        data: [
          { id: "dddddddd-0000-4000-8000-000000000010", rider_id: RIDER_ID_1, amount: 5_000 },
          { id: "dddddddd-0000-4000-8000-000000000011", rider_id: RIDER_ID_2, amount: 5_000 },
        ],
      },
      { table: "contracts",    data: existingContracts },
      { table: "team_sponsors", data: sponsorRow },
      // No auction_bids step expected
    ]);

    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({
      error: expect.stringMatching(/[Rr]oster|[Ss]lot/),
    });
  });

  it("accepts exactly filling the last slot (5 active + 1 draft = 6 for level 1)", async () => {
    const existingContracts = Array.from({ length: 5 }, (_, i) => ({
      id: `ffffffff-0000-4000-8000-00000000000${i + 1}`,
      locked_salary: 5_000,
    }));

    const { recordedInserts } = installSequence([
      { table: "league_members", data: { team_id: TEAM_ID } },
      { table: "teams",          data: teamRow({ level: 1 }) },
      { table: "auctions",       data: auctionRow() },
      {
        table: "draft_bids",
        data: [{ id: "dddddddd-0000-4000-8000-000000000010", rider_id: RIDER_ID_1, amount: 5_000 }],
      },
      { table: "contracts",     data: existingContracts },
      { table: "team_sponsors", data: sponsorRow },
      { table: "auction_bids",  data: null }, // cancel old
      { table: "auction_bids",  data: null }, // insert 1
    ]);

    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toEqual({ success: true });

    const inserts = recordedInserts["auction_bids"] as Array<unknown[]>;
    expect((inserts[0] as unknown[]).length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 6. Empty drafts list — idempotent re-validation
  // -------------------------------------------------------------------------

  it("cancels previous active bids and inserts nothing when draft list is empty", async () => {
    const { recordedUpdates, recordedInserts } = installSequence([
      { table: "league_members", data: { team_id: TEAM_ID } },
      { table: "teams",          data: teamRow() },
      { table: "auctions",       data: auctionRow() },
      { table: "draft_bids",     data: [] },          // empty
      { table: "contracts",      data: [] },
      { table: "team_sponsors",  data: sponsorRow },
      { table: "auction_bids",   data: null },         // cancel old only
      // No insert step — draftList.length === 0
    ]);

    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toEqual({ success: true });

    // Cancellation still fires
    expect(recordedUpdates["auction_bids"]).toHaveLength(1);
    expect(recordedUpdates["auction_bids"][0]).toMatchObject({ status: "cancelled" });

    // No insert at all
    expect(recordedInserts["auction_bids"]).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // 7. phase_confirmed_id matches current phase → post-payday budget formula
  // -------------------------------------------------------------------------

  it("uses post-payday formula (treasury - draftTotal) when phase is confirmed", async () => {
    // phase_confirmed_id === CURRENT_PHASE_ID → phaseConfirmed = true
    // treasury=100_000, draftTotal=90_000 → remaining=10_000 (ok)
    // sponsor/salaries are NOT projected in this branch
    const { recordedInserts } = installSequence([
      { table: "league_members", data: { team_id: TEAM_ID } },
      {
        table: "teams",
        data: teamRow({
          treasury: 100_000,
          phase_confirmed_id: CURRENT_PHASE_ID, // matches getCurrentPhase().id
        }),
      },
      { table: "auctions",      data: auctionRow() },
      {
        table: "draft_bids",
        data: [
          { id: "dddddddd-0000-4000-8000-000000000010", rider_id: RIDER_ID_1, amount: 50_000 },
          { id: "dddddddd-0000-4000-8000-000000000011", rider_id: RIDER_ID_2, amount: 40_000 },
        ],
      },
      // High salaries that would kill pre-payday budget but are ignored post-confirmation
      { table: "contracts",     data: [{ id: CONTRACT_ID_1, locked_salary: 300_000 }] },
      { table: "team_sponsors", data: sponsorRow },
      { table: "auction_bids",  data: null },
      { table: "auction_bids",  data: null },
    ]);

    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toEqual({ success: true });

    const inserts = recordedInserts["auction_bids"] as Array<unknown[]>;
    expect((inserts[0] as unknown[]).length).toBe(2);
  });

  it("rejects post-payday when treasury alone cannot cover drafts", async () => {
    // phaseConfirmed = true, treasury=50_000, draftTotal=60_000 → remaining=-10_000
    installSequence([
      { table: "league_members", data: { team_id: TEAM_ID } },
      {
        table: "teams",
        data: teamRow({
          treasury: 50_000,
          phase_confirmed_id: CURRENT_PHASE_ID,
        }),
      },
      { table: "auctions",      data: auctionRow() },
      {
        table: "draft_bids",
        data: [
          { id: "dddddddd-0000-4000-8000-000000000010", rider_id: RIDER_ID_1, amount: 60_000 },
        ],
      },
      { table: "contracts",     data: [] },
      { table: "team_sponsors", data: sponsorRow },
      // No auction_bids step expected
    ]);

    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({ error: expect.stringMatching(/budget/i) });
  });

  // -------------------------------------------------------------------------
  // 8. No open auction round
  // -------------------------------------------------------------------------

  it("returns error when no open auction round exists", async () => {
    installSequence([
      { table: "league_members", data: { team_id: TEAM_ID } },
      { table: "teams",          data: teamRow() },
      { table: "auctions",       data: null }, // no open auction
    ]);

    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({ error: expect.any(String) });
  });

  // -------------------------------------------------------------------------
  // 9. DB errors propagate
  // -------------------------------------------------------------------------

  it("propagates draft_bids DB errors", async () => {
    installSequence([
      { table: "league_members", data: { team_id: TEAM_ID } },
      { table: "teams",          data: teamRow() },
      { table: "auctions",       data: auctionRow() },
      { table: "draft_bids",     data: null, error: { message: "DB connection lost" } },
    ]);

    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({ error: "DB connection lost" });
  });

  it("propagates contracts DB errors", async () => {
    installSequence([
      { table: "league_members", data: { team_id: TEAM_ID } },
      { table: "teams",          data: teamRow() },
      { table: "auctions",       data: auctionRow() },
      { table: "draft_bids",     data: [] },
      { table: "contracts",      data: null, error: { message: "contracts query failed" } },
    ]);

    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({ error: "contracts query failed" });
  });

  it("propagates auction_bids cancel errors", async () => {
    installSequence([
      { table: "league_members", data: { team_id: TEAM_ID } },
      { table: "teams",          data: teamRow() },
      { table: "auctions",       data: auctionRow() },
      { table: "draft_bids",     data: [] },
      { table: "contracts",      data: [] },
      { table: "team_sponsors",  data: sponsorRow },
      { table: "auction_bids",   data: null, error: { message: "update failed" } },
    ]);

    const result = await validateRound({ leagueId: LEAGUE_ID });
    expect(result).toMatchObject({ error: "update failed" });
  });
});
