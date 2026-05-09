// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RaceCardFuture } from "../race-card-future";
import type { RaceData } from "@/lib/race-feed-types";

const gtStage: RaceData = {
  raceSlug: "race/giro-d-italia/2026/stage-3",
  raceName: "Giro d'Italia - Stage 3",
  raceTitle: "Giro · Étape 3",
  parentRaceSlug: "race/giro-d-italia/2026",
  parentRaceLabel: "Giro",
  raceDate: "2026-05-06",
  raceType: "stage",
  status: "future",
  isGtPhase: true,
};

const classic: RaceData = {
  raceSlug: "race/paris-roubaix/2026",
  raceName: "Paris-Roubaix",
  raceTitle: "Paris-Roubaix",
  parentRaceSlug: null,
  parentRaceLabel: null,
  raceDate: "2026-04-12",
  raceType: "classic",
  status: "future",
  isGtPhase: false,
};

describe("RaceCardFuture", () => {
  it("renders title", () => {
    render(<RaceCardFuture race={gtStage} leagueId="league-1" />);
    expect(screen.getByText("Giro · Étape 3")).toBeInTheDocument();
  });

  it("renders + button linking to tactics for GT phases", () => {
    render(<RaceCardFuture race={gtStage} leagueId="league-1" />);
    const link = screen.getByRole("link", { name: /Placer une tactique/ });
    expect(link).toHaveAttribute(
      "href",
      "/league/league-1/team/gt/tactics?race=race%2Fgiro-d-italia%2F2026%2Fstage-3"
    );
  });

  it("does not render + button for classics", () => {
    render(<RaceCardFuture race={classic} leagueId="league-1" />);
    expect(screen.queryByRole("link", { name: /Placer une tactique/ })).not.toBeInTheDocument();
  });
});
