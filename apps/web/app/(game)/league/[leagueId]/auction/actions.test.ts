import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that consume them.
// ---------------------------------------------------------------------------

const { mockFrom, mockGetUser, mockGetCurrentPhase, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetCurrentPhase: vi.fn(),
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
  getCurrentPhase: mockGetCurrentPhase,
}));

// NOTE: lib/budget.ts and lib/levels.ts are pure functions — intentionally NOT mocked.

import { validateRound } from "./actions";

// ---------------------------------------------------------------------------
// Test UUIDs (RFC-4122 v4: version nibble = 4, variant nibble = 8)
// ---------------------------------------------------------------------------

const LEAGUE_ID = "cccccccc-0000-4000-8000-000000000001";

const CURRENT_PHASE_ID = 3;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("validateRound (via RPC)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentPhase.mockReturnValue({ id: CURRENT_PHASE_ID, label: "Classics Part 2" });
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
  // 4. Happy path
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
});
