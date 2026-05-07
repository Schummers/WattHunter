import { describe, it, expect, vi, beforeEach } from "vitest";
import { installSequence as sharedInstallSequence } from "@/test-utils/supabase-mock";

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

const mockSupabase = {
  from: mockFrom,
  rpc: mockRpc,
  auth: { getUser: vi.fn() },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  addToSquad,
  removeFromSquad,
  swapSlot,
  assignRole,
  clearRole,
} from "./actions";

const TEAM_ID = "550e8400-e29b-41d4-a716-446655440001";
const RIDER_ID = "550e8400-e29b-41d4-a716-446655440002";
const RIDER_ID_2 = "550e8400-e29b-41d4-a716-446655440003";
const LEAGUE_ID = "550e8400-e29b-41d4-a716-446655440004";

function installLeagueLookup() {
  // After every successful RPC, actions fetch teams.league_id for revalidatePath.
  return sharedInstallSequence(mockFrom, [
    { table: "teams", data: { league_id: LEAGUE_ID } },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// addToSquad
// ---------------------------------------------------------------------------

describe("addToSquad", () => {
  it("calls gt_add_to_squad RPC and returns ok on success", async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    installLeagueLookup();

    const result = await addToSquad({
      teamId: TEAM_ID,
      riderId: RIDER_ID,
      role: "gc_leader",
      phaseId: 4,
      year: 2026,
    });

    expect(result).toEqual({ ok: true });
    expect(mockRpc).toHaveBeenCalledWith("gt_add_to_squad", {
      p_team_id: TEAM_ID,
      p_rider_id: RIDER_ID,
      p_role: "gc_leader",
      p_phase_id: 4,
      p_year: 2026,
    });
  });

  it("forwards RPC error message", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { error: "Role gc_leader is at capacity (1)" },
      error: null,
    });

    await expect(
      addToSquad({ teamId: TEAM_ID, riderId: RIDER_ID, role: "gc_leader", phaseId: 4, year: 2026 })
    ).rejects.toThrow(/capacity/i);
    expect(mockRpc).toHaveBeenCalledOnce();
  });

  it("forwards low-level Supabase errors", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "network down" } });

    await expect(
      addToSquad({ teamId: TEAM_ID, riderId: RIDER_ID, role: "gc_leader", phaseId: 4, year: 2026 })
    ).rejects.toThrow(/network down/);
  });

  it("rejects an invalid role at the Zod layer (no RPC call)", async () => {
    await expect(
      addToSquad({
        teamId: TEAM_ID,
        riderId: RIDER_ID,
        role: "not-a-role" as never,
        phaseId: 4,
        year: 2026,
      })
    ).rejects.toThrow();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects an invalid UUID at the Zod layer (no RPC call)", async () => {
    await expect(
      addToSquad({
        teamId: "not-a-uuid",
        riderId: RIDER_ID,
        role: "gc_leader",
        phaseId: 4,
        year: 2026,
      })
    ).rejects.toThrow();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// removeFromSquad
// ---------------------------------------------------------------------------

describe("removeFromSquad", () => {
  it("calls gt_remove_from_squad RPC", async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    installLeagueLookup();

    const result = await removeFromSquad({
      teamId: TEAM_ID,
      riderId: RIDER_ID,
      phaseId: 4,
      year: 2026,
    });

    expect(result).toEqual({ ok: true });
    expect(mockRpc).toHaveBeenCalledWith("gt_remove_from_squad", {
      p_team_id: TEAM_ID,
      p_rider_id: RIDER_ID,
      p_phase_id: 4,
      p_year: 2026,
    });
  });

  it("forwards RPC error message", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { error: "Rider not in squad" },
      error: null,
    });

    await expect(
      removeFromSquad({ teamId: TEAM_ID, riderId: RIDER_ID, phaseId: 4, year: 2026 })
    ).rejects.toThrow(/not in squad/i);
  });
});

// ---------------------------------------------------------------------------
// swapSlot
// ---------------------------------------------------------------------------

describe("swapSlot", () => {
  it("calls gt_swap_slot RPC with old + new rider ids", async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    installLeagueLookup();

    const result = await swapSlot({
      teamId: TEAM_ID,
      oldRiderId: RIDER_ID,
      newRiderId: RIDER_ID_2,
      phaseId: 4,
      year: 2026,
    });

    expect(result).toEqual({ ok: true });
    expect(mockRpc).toHaveBeenCalledWith("gt_swap_slot", {
      p_team_id: TEAM_ID,
      p_old_rider_id: RIDER_ID,
      p_new_rider_id: RIDER_ID_2,
      p_phase_id: 4,
      p_year: 2026,
    });
  });

  it("forwards RPC errors (old rider not in squad)", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { error: "Old rider not in squad" },
      error: null,
    });

    await expect(
      swapSlot({
        teamId: TEAM_ID,
        oldRiderId: RIDER_ID,
        newRiderId: RIDER_ID_2,
        phaseId: 4,
        year: 2026,
      })
    ).rejects.toThrow(/old rider/i);
  });

  it("forwards RPC errors (new rider already in squad)", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { error: "New rider is already in the squad" },
      error: null,
    });

    await expect(
      swapSlot({
        teamId: TEAM_ID,
        oldRiderId: RIDER_ID,
        newRiderId: RIDER_ID_2,
        phaseId: 4,
        year: 2026,
      })
    ).rejects.toThrow(/already/i);
  });
});

// ---------------------------------------------------------------------------
// assignRole + clearRole
// ---------------------------------------------------------------------------

describe("assignRole", () => {
  it("calls gt_assign_role RPC with the target role", async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    installLeagueLookup();

    const result = await assignRole({
      teamId: TEAM_ID,
      riderId: RIDER_ID,
      role: "stage_hunter",
      phaseId: 4,
      year: 2026,
    });

    expect(result).toEqual({ ok: true });
    expect(mockRpc).toHaveBeenCalledWith("gt_assign_role", {
      p_team_id: TEAM_ID,
      p_rider_id: RIDER_ID,
      p_role: "stage_hunter",
      p_phase_id: 4,
      p_year: 2026,
    });
  });

  it("forwards RPC errors (rider not in squad)", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { error: "Rider not in squad" },
      error: null,
    });

    await expect(
      assignRole({ teamId: TEAM_ID, riderId: RIDER_ID, role: "gc_leader", phaseId: 4, year: 2026 })
    ).rejects.toThrow(/squad/i);
  });

  it("rejects unknown role at Zod layer", async () => {
    await expect(
      assignRole({
        teamId: TEAM_ID,
        riderId: RIDER_ID,
        role: "not-a-role" as never,
        phaseId: 4,
        year: 2026,
      })
    ).rejects.toThrow();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("clearRole", () => {
  it("calls gt_assign_role RPC with role=domestique", async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    installLeagueLookup();

    const result = await clearRole({
      teamId: TEAM_ID,
      riderId: RIDER_ID,
      phaseId: 4,
      year: 2026,
    });

    expect(result).toEqual({ ok: true });
    expect(mockRpc).toHaveBeenCalledWith("gt_assign_role", {
      p_team_id: TEAM_ID,
      p_rider_id: RIDER_ID,
      p_role: "domestique",
      p_phase_id: 4,
      p_year: 2026,
    });
  });
});
