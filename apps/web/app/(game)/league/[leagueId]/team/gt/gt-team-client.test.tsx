// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), back: vi.fn() }),
}));

import { GtTeamClient } from "./gt-team-client";

describe("GtTeamClient classic", () => {
  it("hides Sponsors Goals in classic", () => {
    render(
      <GtTeamClient
        {...({} as any)}
        teamId="team-1"
        phaseId={4}
        year={2026}
        underdogEligible={false}
        raceTeamLabel="Giro d'Italia 2026"
        squad={[]}
        availableRiders={[]}
        sponsor={null}
        completedGoalIndices={[]}
        activations={[]}
        stages={[]}
        eligibleGcRivals={[]}
        eligibleSprintRivals={[]}
        myGcLeader={null}
        mySprinter={null}
        incomingNemesis={[]}
        mode="classic"
      />,
    );
    expect(screen.queryByText(/Sponsors Goals/i)).toBeNull();
  });
});
