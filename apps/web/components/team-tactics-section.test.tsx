// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TeamTacticsSection } from "./team-tactics-section";

describe("TeamTacticsSection classic", () => {
  it("does not render Call the Bus in classic", () => {
    render(
      <TeamTacticsSection
        teamId="team-1"
        phaseId={4}
        year={2026}
        activations={[]}
        stages={[]}
        eligibleGcRivals={[]}
        eligibleSprintRivals={[]}
        myGcLeader={null}
        mySprinter={null}
        mode="classic"
      />,
    );
    expect(screen.queryByText(/Call the Bus/i)).toBeNull();
  });
});
