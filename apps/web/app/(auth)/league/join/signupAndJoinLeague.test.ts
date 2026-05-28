import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockRpc, mockGetUser, mockSignUp, mockRedirect } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockGetUser: vi.fn(),
  mockSignUp: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    rpc: mockRpc,
    auth: { getUser: mockGetUser, signUp: mockSignUp },
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { signupAndJoinLeague } from "./actions";

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe("signupAndJoinLeague action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid code", async () => {
    const result = await signupAndJoinLeague(
      null,
      makeFormData({
        code: "!@#$%^",
        team_name: "MyTeam",
        email: "a@b.com",
        password: "secret123",
        confirm_password: "secret123",
      })
    );
    expect(result).toMatchObject({ error: expect.stringContaining("code") });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords", async () => {
    const result = await signupAndJoinLeague(
      null,
      makeFormData({
        code: "ABCDEF",
        team_name: "MyTeam",
        email: "a@b.com",
        password: "secret123",
        confirm_password: "different",
      })
    );
    expect(result).toMatchObject({ error: expect.stringContaining("match") });
  });

  it("returns signUp error", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Email already registered" },
    });

    const result = await signupAndJoinLeague(
      null,
      makeFormData({
        code: "ABCDEF",
        team_name: "MyTeam",
        email: "taken@b.com",
        password: "secret123",
        confirm_password: "secret123",
      })
    );

    expect(result).toMatchObject({ error: expect.stringContaining("Email already") });
  });

  it("maps 'League not found' RPC error", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: { access_token: "tok" } },
      error: null,
    });
    mockFrom.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });
    // Real RPC returns { error: '...' } without an 'ok' key on error paths
    mockRpc.mockResolvedValue({
      data: { error: "League not found" },
      error: null,
    });

    const result = await signupAndJoinLeague(
      null,
      makeFormData({
        code: "ABCDEF",
        team_name: "MyTeam",
        email: "a@b.com",
        password: "secret123",
        confirm_password: "secret123",
      })
    );

    expect(result).toMatchObject({ error: expect.stringContaining("Invalid code") });
  });

  it("creates account + joins league + redirects on success", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: "user-1" }, session: { access_token: "tok" } },
      error: null,
    });

    const sponsorLookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "sponsor-1" }, error: null }),
    };
    const teamSponsorInsert = {
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockFrom
      .mockReturnValueOnce({ upsert: vi.fn().mockResolvedValue({ error: null }) }) // users upsert
      .mockReturnValueOnce(sponsorLookup)      // sponsors lookup (I1 auto-assign)
      .mockReturnValueOnce(teamSponsorInsert); // team_sponsors insert

    mockRpc.mockResolvedValue({
      data: { ok: true, league_id: "league-1", late_join: false, already_member: false, team_id: "team-1", starting_level: 1 },
      error: null,
    });
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      signupAndJoinLeague(
        null,
        makeFormData({
          code: "ABCDEF",
          team_name: "MyTeam",
          email: "a@b.com",
          password: "secret123",
          confirm_password: "secret123",
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRpc).toHaveBeenCalledWith("join_league_by_code", expect.objectContaining({
      p_code: "ABCDEF",
    }));
    expect(mockRedirect).toHaveBeenCalledWith("/league/league-1");
  });
});
