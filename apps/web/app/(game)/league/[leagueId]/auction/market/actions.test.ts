import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockGetUser } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
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
  getCurrentPhase: () => ({ id: 4, label: "Giro d'Italia" }),
}));

import { confirmPhaseSetup } from "./actions";

function makeChain(data: unknown = null, error: unknown = null) {
  const result = { data, error, count: Array.isArray(data) ? data.length : 0 };
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
    "single", "maybeSingle", "update", "insert", "upsert", "delete",
    "not", "is",
  ]) {
    chain[m] = () => chain;
  }
  return chain;
}

const USER_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEAM_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const LEAGUE_ID = "eeeeeeee-0000-0000-0000-000000000001";
describe("confirmPhaseSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  });

  it("returns error when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await confirmPhaseSetup(TEAM_ID);
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns error when already confirmed for current phase", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain({
          id: TEAM_ID,
          league_id: LEAGUE_ID,
          phase_confirmed_id: 4, // already confirmed for phase 4 (current)
          pending_sponsor_id: null,
        });
      }
      return makeChain(null);
    });

    const result = await confirmPhaseSetup(TEAM_ID);
    expect(result).toEqual({ error: "Already confirmed for this phase" });
  });

  it("applies sponsor + policy changes and marks phase confirmed", async () => {
    let callCount = 0;

    mockFrom.mockImplementation(() => {
      callCount++;

      // 1. Team fetch
      if (callCount === 1) {
        return makeChain({
          id: TEAM_ID,
          league_id: LEAGUE_ID,
          phase_confirmed_id: 3, // last confirmed phase 3, current is 4
          pending_sponsor_id: null,
        });
      }

      // 2. team_policies fetch (pending changes) — no pending
      if (callCount === 2) {
        return makeChain([]);
      }

      // All other calls succeed (teams.update for mark confirmed)
      return makeChain(null);
    });

    const result = await confirmPhaseSetup(TEAM_ID);

    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("phaseId", 4);
    expect(result).toHaveProperty("phaseLabel", "Giro d'Italia");
  });
});
