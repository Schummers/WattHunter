// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RaceTeamBreakdown } from "../race-team-breakdown";
import type { TeamRaceResult } from "@/lib/race-feed-types";

const sampleTeams: TeamRaceResult[] = [
  {
    teamId: "t1",
    teamName: "Team Astrid",
    isMyTeam: false,
    totalXp: 340,
    totalBonusEur: 12000,
    riders: [
      { riderId: "r1", riderShortName: "T. Pogacar", role: "GC", xpGained: 180, bonusEur: 12000 },
      { riderId: "r2", riderShortName: "J. Vingegaard", role: null, xpGained: 90, bonusEur: 0 },
      { riderId: "r3", riderShortName: "E. Mas", role: "DOM", xpGained: 70, bonusEur: 0 },
    ],
  },
  {
    teamId: "me",
    teamName: "Mon équipe",
    isMyTeam: true,
    totalXp: 280,
    totalBonusEur: 8000,
    riders: [
      { riderId: "r4", riderShortName: "M. van Aert", role: "SPR", xpGained: 120, bonusEur: 8000 },
      { riderId: "r5", riderShortName: "J. Almeida", role: "DOM", xpGained: 90, bonusEur: 0 },
    ],
  },
];

describe("RaceTeamBreakdown", () => {
  it("renders all teams with their riders", () => {
    render(<RaceTeamBreakdown teams={sampleTeams} isGtPhase />);
    expect(screen.getByText("Team Astrid")).toBeInTheDocument();
    expect(screen.getByText(/Mon équipe/)).toBeInTheDocument();
    expect(screen.getByText("T. Pogacar")).toBeInTheDocument();
    expect(screen.getByText("M. van Aert")).toBeInTheDocument();
  });

  it("highlights my team with a star", () => {
    render(<RaceTeamBreakdown teams={sampleTeams} isGtPhase />);
    expect(screen.getByText(/★/)).toBeInTheDocument();
  });

  it("formats team total bonus in euros and total XP with + prefix", () => {
    render(<RaceTeamBreakdown teams={sampleTeams} isGtPhase />);
    expect(screen.getByText("+12 000€")).toBeInTheDocument();
    expect(screen.getByText("+340")).toBeInTheDocument();
    expect(screen.getByText("+8 000€")).toBeInTheDocument();
    expect(screen.getByText("+280")).toBeInTheDocument();
  });

  it("renders em-dash for riders without bonus", () => {
    render(<RaceTeamBreakdown teams={sampleTeams} isGtPhase />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("renders rider role badges only when isGtPhase is true", () => {
    const { rerender } = render(<RaceTeamBreakdown teams={sampleTeams} isGtPhase />);
    expect(screen.getByText("GC")).toBeInTheDocument();
    expect(screen.getByText("SPR")).toBeInTheDocument();

    rerender(<RaceTeamBreakdown teams={sampleTeams} isGtPhase={false} />);
    expect(screen.queryByText("GC")).not.toBeInTheDocument();
    expect(screen.queryByText("SPR")).not.toBeInTheDocument();
  });

  it("does not render teams with empty riders array", () => {
    const teamsWithEmpty: TeamRaceResult[] = [
      ...sampleTeams,
      { teamId: "empty", teamName: "Pelu's Crew", isMyTeam: false, totalXp: 0, totalBonusEur: 0, riders: [] },
    ];
    render(<RaceTeamBreakdown teams={teamsWithEmpty} isGtPhase />);
    expect(screen.queryByText("Pelu's Crew")).not.toBeInTheDocument();
  });
});
