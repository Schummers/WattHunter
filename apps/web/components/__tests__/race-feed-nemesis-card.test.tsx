// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RaceFeedNemesisCard } from "../race-feed-nemesis-card";
import type { NemesisData } from "@/lib/race-feed-types";

const winData: NemesisData = {
  activationId: "act-1",
  raceSlug: "race/giro-d-italia/2026/stage-2",
  attackerTeamName: "Mon équipe",
  attackerRiderShortName: "T. Pogacar",
  targetTeamName: "Team Astrid",
  targetRiderShortName: "J. Vingegaard",
  outcome: "attacker_won",
  isMyTeamAttacker: true,
};

describe("RaceFeedNemesisCard", () => {
  it("renders attacker and target rider names", () => {
    render(<RaceFeedNemesisCard data={winData} />);
    expect(screen.getByText(/T\. Pogacar/)).toBeInTheDocument();
    expect(screen.getByText(/J\. Vingegaard/)).toBeInTheDocument();
  });

  it("renders 'win' outcome with success color when my team attacked and won", () => {
    render(<RaceFeedNemesisCard data={winData} />);
    expect(screen.getByText(/→ Mon équipe/)).toBeInTheDocument();
  });

  it("renders 'loss' outcome when my team attacked but target won", () => {
    render(
      <RaceFeedNemesisCard data={{ ...winData, outcome: "target_won" }} />
    );
    expect(screen.getByText(/→ Team Astrid/)).toBeInTheDocument();
  });

  it("renders 'pending' status when not yet resolved", () => {
    render(
      <RaceFeedNemesisCard data={{ ...winData, outcome: "pending" }} />
    );
    expect(screen.getByText(/Pending/)).toBeInTheDocument();
  });
});
