// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RaceCardToday } from "../race-card-today";
import type { RaceDataWithBreakdown } from "@/lib/race-feed-types";

const baseRace: RaceDataWithBreakdown = {
  raceSlug: "race/giro-d-italia/2026/stage-2",
  raceName: "Giro d'Italia - Stage 2",
  raceTitle: "Giro · Stage 2",
  parentRaceSlug: "race/giro-d-italia/2026",
  parentRaceLabel: "Giro",
  raceDate: "2026-05-05",
  raceType: "stage",
  status: "today",
  isGtPhase: true,
  winnerTeamId: "t1",
  winnerTeamInitials: "TA",
  winnerTeamName: "Team Astrid",
  winnerTeamBadgeUrl: null,
  winnerTeamBannerUrl: null,
  winnerTeamAchievementName: null,
  winnerTeamAchievementTier: null,
  jerseys: [],
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

describe("RaceCardToday", () => {
  it("renders title, winner avatar and breakdown", () => {
    render(<RaceCardToday race={baseRace} leagueId="league-1" />);
    expect(screen.getByText("Giro · Stage 2")).toBeInTheDocument();
    expect(screen.getByText("TA")).toBeInTheDocument();
    expect(screen.getByText("T. Pogacar")).toBeInTheDocument();
  });

  it("renders GC standings link for stage races (GT)", () => {
    render(<RaceCardToday race={baseRace} leagueId="league-1" />);
    const link = screen.getByRole("link", { name: /GC Ranking/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href",
      "/league/league-1/ranking?race=race%2Fgiro-d-italia%2F2026"
    );
  });

  it("does not render GC link for classics (one-day races)", () => {
    const classic: RaceDataWithBreakdown = {
      ...baseRace,
      raceSlug: "race/paris-roubaix/2026",
      raceName: "Paris-Roubaix",
      raceTitle: "Paris-Roubaix",
      raceType: "classic",
      parentRaceSlug: null,
      parentRaceLabel: null,
      isGtPhase: false,
    };
    render(<RaceCardToday race={classic} leagueId="league-1" />);
    expect(screen.queryByRole("link", { name: /GC standings/ })).not.toBeInTheDocument();
  });
});
