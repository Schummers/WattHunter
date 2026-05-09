// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RaceFeed } from "../race-feed";
import type { RaceFeedPayload, RaceDataWithBreakdown, RaceData } from "@/lib/race-feed-types";

const pastRace: RaceDataWithBreakdown = {
  raceSlug: "race/giro-d-italia/2026/stage-1",
  raceName: "Giro - 1",
  raceTitle: "Giro · Étape 1",
  parentRaceSlug: "race/giro-d-italia/2026",
  parentRaceLabel: "Giro",
  raceDate: "2026-05-04",
  raceType: "stage",
  status: "past",
  isGtPhase: true,
  winnerTeamId: "t1",
  winnerTeamInitials: "TA",
  teams: [],
};

const todayRace: RaceDataWithBreakdown = {
  ...pastRace,
  raceSlug: "race/giro-d-italia/2026/stage-2",
  raceTitle: "Giro · Étape 2",
  raceDate: "2026-05-05",
  status: "today",
};

const futureRace: RaceData = {
  raceSlug: "race/giro-d-italia/2026/stage-3",
  raceName: "Giro - 3",
  raceTitle: "Giro · Étape 3",
  parentRaceSlug: "race/giro-d-italia/2026",
  parentRaceLabel: "Giro",
  raceDate: "2026-05-06",
  raceType: "stage",
  status: "future",
  isGtPhase: true,
};

const payload: RaceFeedPayload = {
  groups: [
    { date: "2026-05-04", cards: [{ type: "past", race: pastRace }] },
    { date: "2026-05-05", cards: [{ type: "today", race: todayRace }] },
    { date: "2026-05-06", cards: [{ type: "future", race: futureRace }] },
  ],
  nextPhaseRound1Date: "2026-05-28",
  nextPhaseLabel: "Pre-Tour",
  isGtPhase: true,
  phaseId: 4,
};

describe("RaceFeed", () => {
  it("renders one group per date with proper labels", () => {
    render(<RaceFeed leagueId="L1" payload={payload} />);
    expect(screen.getByText("4 mai")).toBeInTheDocument();
    expect(screen.getByText("5 mai")).toBeInTheDocument();
    expect(screen.getByText("6 mai")).toBeInTheDocument();
  });

  it("renders past, today, and future cards", () => {
    render(<RaceFeed leagueId="L1" payload={payload} />);
    expect(screen.getByText("Giro · Étape 1")).toBeInTheDocument();
    expect(screen.getByText("Giro · Étape 2")).toBeInTheDocument();
    expect(screen.getByText("Giro · Étape 3")).toBeInTheDocument();
  });

  it("renders the phase end banner at the bottom", () => {
    render(<RaceFeed leagueId="L1" payload={payload} />);
    expect(screen.getByText(/Next phase/)).toBeInTheDocument();
    expect(screen.getByText(/Round 1 opens/)).toBeInTheDocument();
  });

  it("renders only the phase end banner when no groups", () => {
    render(
      <RaceFeed
        leagueId="L1"
        payload={{ groups: [], nextPhaseRound1Date: "2026-06-02", nextPhaseLabel: "Pre-Tour", isGtPhase: false, phaseId: 5 }}
      />
    );
    expect(screen.getByText(/Next phase/)).toBeInTheDocument();
  });
});
