import { describe, it, expect, vi, beforeEach } from "vitest";
import { installSequence as sharedInstallSequence } from "@/test-utils/supabase-mock";

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

import { assignRole, clearRole, ensureGtSquad } from "./actions";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const USER_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const TEAM_ID = "bbbbbbbb-0000-4000-8000-000000000001";
const RIDER_ID = "cccccccc-0000-4000-8000-000000000001";
const RIDER_ID_2 = "cccccccc-0000-4000-8000-000000000002";
const LEAGUE_ID = "dddddddd-0000-4000-8000-000000000001";

function teamRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TEAM_ID,
    user_id: USER_ID,
    league_id: LEAGUE_ID,
    ...overrides,
  };
}

// Local wrapper over shared installSequence — bound to this file's mockFrom.
function installSequence(steps: Array<{ table: string; data?: unknown; error?: unknown }>) {
  return sharedInstallSequence(mockFrom, steps);
}

// ---------------------------------------------------------------------------
// assignRole
// ---------------------------------------------------------------------------

describe("assignRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  });

  it("rejects an unknown role", async () => {
    installSequence([{ table: "teams", data: teamRow() }]);
    await expect(
      assignRole({
        teamId: TEAM_ID,
        riderId: RIDER_ID,
        role: "not-a-role" as never,
        phaseId: 4,
        year: 2026,
      })
    ).rejects.toThrow();
  });

  it("rejects if the user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(
      assignRole({ teamId: TEAM_ID, riderId: RIDER_ID, role: "gc_leader", phaseId: 4, year: 2026 })
    ).rejects.toThrow(/authenticated/i);
  });

  it("rejects non-owner writes", async () => {
    installSequence([
      { table: "teams", data: teamRow({ user_id: "someone-else" }) },
    ]);
    await expect(
      assignRole({ teamId: TEAM_ID, riderId: RIDER_ID, role: "gc_leader", phaseId: 4, year: 2026 })
    ).rejects.toThrow(/owner/i);
  });

  it("rejects riders not in the squad", async () => {
    installSequence([
      { table: "teams", data: teamRow() },
      { table: "gt_squad", data: [] }, // empty — rider not in squad
    ]);
    await expect(
      assignRole({ teamId: TEAM_ID, riderId: RIDER_ID, role: "gc_leader", phaseId: 4, year: 2026 })
    ).rejects.toThrow(/squad/i);
  });

  it("inserts a role row on the happy path (non-capped case)", async () => {
    const { recordedInserts } = installSequence([
      { table: "teams", data: teamRow() },
      { table: "gt_squad", data: [{ rider_id: RIDER_ID }] },
      { table: "gt_role_assignments", data: [] },            // latestRolesMap — no existing gc_leader
      { table: "gt_role_assignments", data: null },          // insert new role
    ]);
    const result = await assignRole({
      teamId: TEAM_ID,
      riderId: RIDER_ID,
      role: "gc_leader",
      phaseId: 4,
      year: 2026,
    });
    expect(result).toEqual({ ok: true });

    expect(recordedInserts["gt_role_assignments"]).toHaveLength(1);
    expect(recordedInserts["gt_role_assignments"][0]).toMatchObject({
      team_id: TEAM_ID,
      rider_id: RIDER_ID,
      phase_id: 4,
      year: 2026,
      role: "gc_leader",
    });
  });

  it("demotes the existing holder when assigning a capped role", async () => {
    const { recordedInserts } = installSequence([
      { table: "teams", data: teamRow() },
      { table: "gt_squad", data: [{ rider_id: RIDER_ID }, { rider_id: RIDER_ID_2 }] },
      // latestRolesMap — RIDER_ID_2 already holds gc_leader (cap=1).
      {
        table: "gt_role_assignments",
        data: [
          { rider_id: RIDER_ID_2, role: "gc_leader", applied_at: "2026-05-10T09:00Z" },
        ],
      },
      { table: "gt_role_assignments", data: null }, // demote insert
      { table: "gt_role_assignments", data: null }, // new role insert
    ]);

    await assignRole({
      teamId: TEAM_ID,
      riderId: RIDER_ID,
      role: "gc_leader",
      phaseId: 4,
      year: 2026,
    });

    const inserts = recordedInserts["gt_role_assignments"];
    expect(inserts).toHaveLength(2);
    // 1st insert demotes the existing holder
    expect(inserts[0]).toMatchObject({
      rider_id: RIDER_ID_2,
      role: "domestique",
    });
    // 2nd insert assigns the new role
    expect(inserts[1]).toMatchObject({
      rider_id: RIDER_ID,
      role: "gc_leader",
    });
  });

  it("stage_hunter tolerates up to 2 holders (no demote for the 2nd)", async () => {
    const { recordedInserts } = installSequence([
      { table: "teams", data: teamRow() },
      { table: "gt_squad", data: [{ rider_id: RIDER_ID }, { rider_id: RIDER_ID_2 }] },
      // latestRolesMap — 1 existing stage_hunter; cap=2 so no demote.
      {
        table: "gt_role_assignments",
        data: [{ rider_id: RIDER_ID_2, role: "stage_hunter", applied_at: "t0" }],
      },
      { table: "gt_role_assignments", data: null }, // new role insert only
    ]);

    await assignRole({
      teamId: TEAM_ID,
      riderId: RIDER_ID,
      role: "stage_hunter",
      phaseId: 4,
      year: 2026,
    });

    const inserts = recordedInserts["gt_role_assignments"];
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      rider_id: RIDER_ID,
      role: "stage_hunter",
    });
  });
});

// ---------------------------------------------------------------------------
// clearRole
// ---------------------------------------------------------------------------

describe("clearRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  });

  it("is a shorthand for assignRole → domestique (never demotes)", async () => {
    const { recordedInserts } = installSequence([
      { table: "teams", data: teamRow() },
      { table: "gt_squad", data: [{ rider_id: RIDER_ID }] },
      { table: "gt_role_assignments", data: null }, // insert domestique only
    ]);

    const result = await clearRole({
      teamId: TEAM_ID,
      riderId: RIDER_ID,
      phaseId: 4,
      year: 2026,
    });
    expect(result).toEqual({ ok: true });

    const inserts = recordedInserts["gt_role_assignments"];
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      rider_id: RIDER_ID,
      role: "domestique",
    });
  });
});

// ---------------------------------------------------------------------------
// ensureGtSquad
// ---------------------------------------------------------------------------

describe("ensureGtSquad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  });

  it("is idempotent when squad rows already exist", async () => {
    installSequence([
      { table: "teams", data: teamRow() },
      { table: "gt_squad", data: [{ rider_id: RIDER_ID }] }, // non-empty
    ]);
    const res = await ensureGtSquad({ teamId: TEAM_ID, phaseId: 4, year: 2026 });
    expect(res).toEqual({ inserted: 0 });
  });

  it("inserts the top-8 contracted riders (by pcs_points_1yr)", async () => {
    const contracts = Array.from({ length: 10 }).map((_, i) => ({
      rider_id: `cccccccc-0000-4000-8000-00000000${String(i + 1).padStart(4, "0")}`,
      riders: { pcs_points_1yr: 100 - i }, // descending
    }));

    const { recordedInserts } = installSequence([
      { table: "teams", data: teamRow() },
      { table: "gt_squad", data: [] }, // empty → populate
      { table: "contracts", data: contracts },
      { table: "gt_squad", data: null },            // insert squad
      { table: "gt_role_assignments", data: null }, // insert roles
    ]);

    const res = await ensureGtSquad({ teamId: TEAM_ID, phaseId: 4, year: 2026 });
    expect(res.inserted).toBe(8);

    expect(recordedInserts["gt_squad"]).toHaveLength(1);
    const squadPayload = recordedInserts["gt_squad"][0] as Array<{ rider_id: string }>;
    expect(squadPayload).toHaveLength(8);
    // Highest pcs_points_1yr goes first (rider #1).
    expect(squadPayload[0].rider_id).toBe(contracts[0].rider_id);
    expect(squadPayload[7].rider_id).toBe(contracts[7].rider_id);

    const rolesPayload = recordedInserts["gt_role_assignments"][0] as Array<{ role: string }>;
    expect(rolesPayload).toHaveLength(8);
    expect(rolesPayload.every((r) => r.role === "domestique")).toBe(true);
  });

  it("inserts nothing when no active contracts exist", async () => {
    installSequence([
      { table: "teams", data: teamRow() },
      { table: "gt_squad", data: [] },
      { table: "contracts", data: [] },
    ]);
    const res = await ensureGtSquad({ teamId: TEAM_ID, phaseId: 4, year: 2026 });
    expect(res).toEqual({ inserted: 0 });
  });
});
