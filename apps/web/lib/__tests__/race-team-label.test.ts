import { describe, it, expect, vi } from "vitest";
import { installSequence } from "@/test-utils/supabase-mock";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

import { resolveRaceTeamLabel } from "../race-team-label";

const TEAM_ID = "550e8400-e29b-41d4-a716-446655440099";

function makeSupabase(fromImpl: ReturnType<typeof vi.fn>) {
  return { from: fromImpl } as unknown as SupabaseClient<Database>;
}

describe("resolveRaceTeamLabel", () => {
  it("returns the GT short label when a GT is active", async () => {
    const mockFrom = vi.fn();
    mockFrom.mockImplementation(() => {
      throw new Error("from() should not be called when a GT is active");
    });

    const label = await resolveRaceTeamLabel(
      makeSupabase(mockFrom),
      TEAM_ID,
      new Date("2026-05-15T12:00:00Z"),
    );
    expect(label).toBe("Giro Team");
  });

  it("returns 'Tour Team' during Tour de France window", async () => {
    const mockFrom = vi.fn();
    mockFrom.mockImplementation(() => {
      throw new Error("from() should not be called when a GT is active");
    });

    const label = await resolveRaceTeamLabel(
      makeSupabase(mockFrom),
      TEAM_ID,
      new Date("2026-07-10T12:00:00Z"),
    );
    expect(label).toBe("Tour Team");
  });

  it("returns 'Dauphiné Team' during the Dauphiné window when the team has a squad", async () => {
    const mockFrom = vi.fn();
    installSequence(mockFrom, [
      { table: "gt_squad", data: [{ race_slug: "race/dauphine/2026" }] },
    ]);

    const label = await resolveRaceTeamLabel(
      makeSupabase(mockFrom),
      TEAM_ID,
      new Date("2026-06-10T12:00:00Z"),
    );
    expect(label).toBe("Dauphiné Team");
  });

  it("returns the static fallback 'Race Team' when no GT and no active 1-week squad", async () => {
    const mockFrom = vi.fn();
    installSequence(mockFrom, [{ table: "gt_squad", data: [] }]);

    const label = await resolveRaceTeamLabel(
      makeSupabase(mockFrom),
      TEAM_ID,
      new Date("2026-06-03T12:00:00Z"),
    );
    expect(label).toBe("Race Team");
  });
});
