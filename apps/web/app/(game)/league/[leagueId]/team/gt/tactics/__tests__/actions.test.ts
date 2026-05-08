import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase before importing actions
const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({
    rpc: mockRpc,
    from: mockFrom,
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
  }),
}));

import { placeTactic } from "../actions";

// Proper RFC-4122 v4 UUIDs (version nibble = 4, variant nibble = 8 or 9 or a/b)
const TEAM_UUID = "550e8400-e29b-41d4-a716-446655440001";

describe("placeTactic", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it("calls place_tactic RPC with the right params for a boost tactic", async () => {
    mockRpc.mockResolvedValueOnce({ data: "new-id-uuid", error: null });
    await placeTactic({
      teamId: TEAM_UUID,
      phaseId: 4,
      year: 2026,
      tacticType: "unleash",
      stageSlug: "race/giro-d-italia/2026/stage-3",
    });
    expect(mockRpc).toHaveBeenCalledWith("place_tactic", {
      p_team_id: TEAM_UUID,
      p_phase_id: 4,
      p_year: 2026,
      p_tactic_type: "unleash",
      p_stage_slug: "race/giro-d-italia/2026/stage-3",
      p_nemesis_target_team_id: undefined,
      p_nemesis_target_role: undefined,
    });
  });

  it("rejects nemesis without target", async () => {
    await expect(
      placeTactic({
        teamId: TEAM_UUID,
        phaseId: 4,
        year: 2026,
        tacticType: "nemesis_gc",
        stageSlug: "race/giro-d-italia/2026/stage-3",
      })
    ).rejects.toThrow(/target/i);
  });

  it("forwards RPC errors", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "limit reached" } });
    await expect(
      placeTactic({
        teamId: TEAM_UUID,
        phaseId: 4,
        year: 2026,
        tacticType: "unleash",
        stageSlug: "race/giro-d-italia/2026/stage-3",
      })
    ).rejects.toThrow(/limit reached/);
  });
});
