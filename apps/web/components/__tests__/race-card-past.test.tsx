// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RaceCardPast } from "../race-card-past";
import type { RaceDataWithBreakdown } from "@/lib/race-feed-types";

const sampleRace: RaceDataWithBreakdown = {
  raceSlug: "race/giro-d-italia/2026/stage-1",
  raceName: "Giro d'Italia - Stage 1",
  raceTitle: "Giro · Stage 1",
  parentRaceSlug: "race/giro-d-italia/2026",
  parentRaceLabel: "Giro",
  raceDate: "2026-05-04",
  raceType: "stage",
  status: "past",
  isGtPhase: true,
  winnerTeamId: "t1",
  winnerTeamInitials: "TA",
  teams: [
    {
      teamId: "t1",
      teamName: "Team Astrid",
      isMyTeam: false,
      totalXp: 340,
      totalBonusEur: 12000,
      riders: [
        { riderId: "r1", riderShortName: "T. Pogacar", role: "GC", xpGained: 180, bonusEur: 12000 },
      ],
    },
  ],
};

describe("RaceCardPast", () => {
  it("renders title and winner avatar (collapsed)", () => {
    render(<RaceCardPast race={sampleRace} leagueId="league-1" />);
    expect(screen.getByText("Giro · Stage 1")).toBeInTheDocument();
    expect(screen.getByText("TA")).toBeInTheDocument();
    // breakdown not shown when collapsed
    expect(screen.queryByText("T. Pogacar")).not.toBeInTheDocument();
  });

  it("expands the breakdown on tap", () => {
    render(<RaceCardPast race={sampleRace} leagueId="league-1" />);
    const trigger = screen.getByRole("button", { name: /Giro/i });
    fireEvent.click(trigger);
    expect(screen.getByText("T. Pogacar")).toBeInTheDocument();
    expect(screen.getByText("Team Astrid")).toBeInTheDocument();
  });

  it("collapses again on second tap", () => {
    render(<RaceCardPast race={sampleRace} leagueId="league-1" />);
    const trigger = screen.getByRole("button", { name: /Giro/i });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByText("T. Pogacar")).not.toBeInTheDocument();
  });

  it("shows fallback dash avatar when there is no winner", () => {
    const noWinner = { ...sampleRace, winnerTeamId: null, winnerTeamInitials: null, teams: [] };
    render(<RaceCardPast race={noWinner} leagueId="league-1" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
