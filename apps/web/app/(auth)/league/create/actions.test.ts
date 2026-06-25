import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared before any imports that consume them.
// ---------------------------------------------------------------------------

const { mockFrom, mockGetUser, mockSignUp, mockSignInWithPassword, mockSignOut, mockRedirect } =
  vi.hoisted(() => ({
    mockFrom: vi.fn(),
    mockGetUser: vi.fn(),
    mockSignUp: vi.fn(),
    mockSignInWithPassword: vi.fn(),
    mockSignOut: vi.fn(),
    mockRedirect: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    auth: {
      getUser: mockGetUser,
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { signupAndCreateLeague, classicTeamDefaults } from "./actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

/** Returns a fluent query object whose terminal calls resolve to `result`. */
function fluentQuery(result: { data: unknown; error: unknown | null }) {
  const q: Record<string, unknown> = {};
  q.select = vi.fn().mockReturnValue(q);
  q.insert = vi.fn().mockReturnValue(q);
  q.upsert = vi.fn().mockResolvedValue(result);
  q.eq = vi.fn().mockReturnValue(q);
  q.single = vi.fn().mockResolvedValue(result);
  q.maybeSingle = vi.fn().mockResolvedValue(result);
  return q;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("classicTeamDefaults", () => {
  it("returns level 8, flat budget, underdog off, no sponsor", () => {
    expect(classicTeamDefaults()).toEqual({
      starting_level: 8,
      treasury: 1_500_000,
      underdog_eligible: false,
      assignSponsor: false,
    });
  });
});

describe("signupAndCreateLeague action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("rejects when league name is too short", async () => {
    const result = await signupAndCreateLeague(
      null,
      makeFormData({
        league_name: "A",
        team_name: "MyTeam",
        email: "a@b.com",
        password: "secret123",
        confirm_password: "secret123",
      })
    );
    expect(result).toMatchObject({ error: expect.stringContaining("League name") });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("rejects when passwords do not match", async () => {
    const result = await signupAndCreateLeague(
      null,
      makeFormData({
        league_name: "Test League",
        team_name: "MyTeam",
        email: "a@b.com",
        password: "secret123",
        confirm_password: "different",
      })
    );
    expect(result).toMatchObject({ error: expect.stringContaining("match") });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("returns supabase signUp error", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Email already registered" },
    });

    const result = await signupAndCreateLeague(
      null,
      makeFormData({
        league_name: "Test League",
        team_name: "MyTeam",
        email: "taken@b.com",
        password: "secret123",
        confirm_password: "secret123",
      })
    );

    expect(result).toMatchObject({ error: expect.stringContaining("Email already") });
  });

  it("signs out when public.users upsert fails after signUp succeeds", async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "new@b.com", user_metadata: {} },
        session: { access_token: "tok" },
      },
      error: null,
    });
    const failingUpsert = fluentQuery({ data: null, error: { message: "FK violation" } });
    mockFrom.mockReturnValueOnce(failingUpsert);

    const result = await signupAndCreateLeague(
      null,
      makeFormData({
        league_name: "Test League",
        team_name: "MyTeam",
        email: "new@b.com",
        password: "secret123",
        confirm_password: "secret123",
      })
    );

    expect(result).toMatchObject({ error: expect.stringContaining("User profile error") });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("signs out when league creation fails after signUp succeeds", async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "new@b.com", user_metadata: {} },
        session: { access_token: "tok" },
      },
      error: null,
    });
    const userUpsert = fluentQuery({ data: null, error: null });
    // Invite-code collision check passes (no collision = .single() returns no row)
    const inviteCodeCheck = fluentQuery({ data: null, error: { code: "PGRST116" } });
    // League insert fails — surfaces via createLeagueWithTeam result.error
    const leagueInsert = fluentQuery({ data: null, error: { message: "leagues insert failed" } });

    mockFrom
      .mockReturnValueOnce(userUpsert)
      .mockReturnValueOnce(inviteCodeCheck)
      .mockReturnValueOnce(leagueInsert);

    const result = await signupAndCreateLeague(
      null,
      makeFormData({
        league_name: "Test League",
        team_name: "MyTeam",
        email: "new@b.com",
        password: "secret123",
        confirm_password: "secret123",
      })
    );

    expect(result).toMatchObject({ error: expect.any(String) });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("creates account + league + team + sponsor + member on success", async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "new@b.com", user_metadata: {} },
        session: { access_token: "tok" },
      },
      error: null,
    });

    // Flow: users.upsert → leagues (collision check) → leagues.insert → teams.insert
    //       → sponsors lookup → team_sponsors.insert → league_members.insert
    const userUpsert = fluentQuery({ data: null, error: null });
    // Invite-code collision check: no existing league found (null data)
    const inviteCodeCheck = fluentQuery({ data: null, error: { code: "PGRST116" } }); // .single() returns null = no collision
    const leagueInsert = fluentQuery({ data: { id: "league-1", invite_code: "ABC123" }, error: null });
    const teamInsert = fluentQuery({ data: { id: "team-1" }, error: null });
    const sponsorLookup = fluentQuery({ data: { id: "sponsor-1" }, error: null });
    const teamSponsorInsert = fluentQuery({ data: null, error: null });
    const memberInsert = fluentQuery({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(userUpsert)       // users upsert
      .mockReturnValueOnce(inviteCodeCheck)  // leagues select (collision check)
      .mockReturnValueOnce(leagueInsert)     // leagues insert
      .mockReturnValueOnce(teamInsert)       // teams insert
      .mockReturnValueOnce(sponsorLookup)    // sponsors select
      .mockReturnValueOnce(teamSponsorInsert) // team_sponsors insert
      .mockReturnValueOnce(memberInsert);    // league_members insert

    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      signupAndCreateLeague(
        null,
        makeFormData({
          league_name: "Test League",
          team_name: "MyTeam",
          email: "new@b.com",
          password: "secret123",
          confirm_password: "secret123",
        })
      )
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockSignUp).toHaveBeenCalledWith({
      email: "new@b.com",
      password: "secret123",
      options: expect.any(Object),
    });
    expect(mockRedirect).toHaveBeenCalledWith("/league/league-1");
  });
});
