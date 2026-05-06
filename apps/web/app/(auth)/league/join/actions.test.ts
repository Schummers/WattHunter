import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared before any imports that consume them.
// ---------------------------------------------------------------------------

const { mockFrom, mockGetUser, mockRpc, mockRedirect } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockRpc: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { joinLeague } from "./actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEAGUE_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const TEAM_ID   = "bbbbbbbb-0000-4000-8000-000000000002";

function makeFormData(code: string): FormData {
  const fd = new FormData();
  fd.append("code", code);
  return fd;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("joinLeague action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "a@b.com", user_metadata: {} } } });
    // Default from() chain for upsert (users table) — no return value needed
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  it("rejects invalid code format", async () => {
    const result = await joinLeague(null, makeFormData("!@#$%^"));
    expect(result).toMatchObject({ error: expect.any(String) });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns error when RPC reports league not found", async () => {
    mockRpc.mockResolvedValue({ data: { error: "League not found" }, error: null });
    const result = await joinLeague(null, makeFormData("AAAAAA"));
    expect(result).toMatchObject({ error: "Invalid code. Check with your Race Director." });
  });

  it("returns error when league is full", async () => {
    mockRpc.mockResolvedValue({ data: { error: "League is full" }, error: null });
    const result = await joinLeague(null, makeFormData("AAAAAA"));
    expect(result).toMatchObject({ error: "This league is full." });
  });

  it("redirects to league home on successful standard join", async () => {
    mockRpc.mockResolvedValue({
      data: { ok: true, league_id: LEAGUE_ID, team_id: TEAM_ID, starting_level: 1, late_join: false },
      error: null,
    });
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "sponsor-1" }, error: null }),
    });

    await joinLeague(null, makeFormData("AAAAAA"));
    expect(mockRedirect).toHaveBeenCalledWith(`/league/${LEAGUE_ID}`);
  });

  it("does NOT assign sponsor on late join", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ok: true,
        league_id: LEAGUE_ID,
        team_id: TEAM_ID,
        starting_level: 3,
        late_join: true,
        can_join_current_phase: false,
      },
      error: null,
    });

    const insertSpy = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      insert: insertSpy,
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "sponsor-x" }, error: null }),
    });

    await joinLeague(null, makeFormData("AAAAAA"));

    expect(mockRedirect).toHaveBeenCalledWith(`/league/${LEAGUE_ID}`);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("still accepts joining an active league (no error returned)", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ok: true,
        league_id: LEAGUE_ID,
        team_id: TEAM_ID,
        starting_level: 2,
        late_join: true,
        can_join_current_phase: true,
      },
      error: null,
    });

    mockFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const result = await joinLeague(null, makeFormData("AAAAAA"));
    expect(result).toBeUndefined();
    expect(mockRedirect).toHaveBeenCalledWith(`/league/${LEAGUE_ID}`);
  });
});
