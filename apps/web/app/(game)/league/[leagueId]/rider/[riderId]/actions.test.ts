import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks (must be before imports) ---
const { mockFrom, mockGetUser } = vi.hoisted(() => {
  return {
    mockFrom: vi.fn(),
    mockGetUser: vi.fn(),
  };
});

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
  getCurrentPhase: () => ({ id: 4, label: "Giro d'Italia" }),
}));

import { releaseRider } from "./actions";

// --- Helper: Supabase query chain mock ---
function makeChain(data: unknown = null, error: unknown = null) {
  const result = { data, error, count: Array.isArray(data) ? data.length : 0 };
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_, prop) {
      if (prop === "data") return data;
      if (prop === "error") return error;
      if (prop === "count") return result.count;
      if (prop === "then") return undefined;
      return (..._args: unknown[]) => new Proxy({} as Record<string, unknown>, handler);
    },
  };
  return new Proxy({} as Record<string, unknown>, handler);
}

const USER_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEAM_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const CONTRACT_ID = "cccccccc-0000-0000-0000-000000000001";
const RIDER_ID = "dddddddd-0000-0000-0000-000000000001";

describe("releaseRider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  });

  it("returns error when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await releaseRider(CONTRACT_ID);
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns error when contract not found", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    const result = await releaseRider(CONTRACT_ID);
    expect(result).toEqual({ error: "Contract not found" });
  });

  it("returns error when not team owner", async () => {
    mockFrom.mockReturnValue(
      makeChain({
        id: CONTRACT_ID,
        team_id: TEAM_ID,
        status: "active",
        locked_salary: 50_000,
        phase_recruited_id: 1,
        teams: { user_id: "someone-else", treasury: 200_000, league_id: "lg-1" },
        riders: { pcs_points_1yr: 300 },
      })
    );
    const result = await releaseRider(CONTRACT_ID);
    expect(result).toEqual({ error: "Not authorized" });
  });

  it("returns error when releasing rider recruited this phase", async () => {
    mockFrom.mockReturnValue(
      makeChain({
        id: CONTRACT_ID,
        team_id: TEAM_ID,
        status: "active",
        locked_salary: 50_000,
        phase_recruited_id: 4, // same as current phase (mocked to 4)
        teams: { user_id: USER_ID, treasury: 200_000, league_id: "lg-1" },
        riders: { pcs_points_1yr: 300 },
      })
    );
    const result = await releaseRider(CONTRACT_ID);
    expect(result).toEqual({ error: "Cannot release a rider recruited during the current phase" });
  });

  // Releasing is free now so there's no treasury check or transfer bonus
  it("successfully releases rider for free", async () => {
    let callCount = 0;

    mockFrom.mockImplementation(() => {
      callCount++;

      // Call 1: contracts select (fetch contract details)
      if (callCount === 1) {
        return makeChain({
          id: CONTRACT_ID,
          team_id: TEAM_ID,
          rider_id: RIDER_ID,
          status: "active",
          locked_salary: 30_000,
          phase_recruited_id: 2,
          teams: { user_id: USER_ID, treasury: 200_000, league_id: "lg-1" },
          riders: { pcs_points_1yr: 500 },
        });
      }

      // Subsequent calls: updates and inserts (all succeed)
      return makeChain(null);
    });

    const result = await releaseRider(CONTRACT_ID);

    expect(result).toEqual({ success: true });
  });
});
