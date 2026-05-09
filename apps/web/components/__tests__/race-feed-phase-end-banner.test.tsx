// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RaceFeedPhaseEndBanner } from "../race-feed-phase-end-banner";

describe("RaceFeedPhaseEndBanner", () => {
  it("renders next phase Round 1 date and link to auction", () => {
    render(
      <RaceFeedPhaseEndBanner
        leagueId="league-1"
        nextPhaseRound1Date="2026-05-28"
        nextPhaseLabel="Pre-Tour"
      />
    );
    expect(screen.getByText(/Round 1 ouvre le 28 mai/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Voir l'enchère/ });
    expect(link).toHaveAttribute("href", "/league/league-1/auction");
  });

  it("renders end-of-season state when no next phase", () => {
    render(
      <RaceFeedPhaseEndBanner
        leagueId="league-1"
        nextPhaseRound1Date={null}
        nextPhaseLabel={null}
      />
    );
    expect(screen.getByText(/Saison terminée/)).toBeInTheDocument();
  });
});
