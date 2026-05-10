// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RaceFeedRemontadaCard } from "../race-feed-remontada-card";
import type { RemontadaData } from "@/lib/race-feed-types";

const data: RemontadaData = {
  boostId: "b1",
  teamId: "t1",
  teamName: "Pelu's Crew",
  isMyTeam: false,
  multiplier: 2.0,
  stagesRemaining: 3,
  triggeredAt: "2026-05-06",
  overtakenTeamName: "bigdaddy",
};

describe("RaceFeedRemontadaCard", () => {
  it("renders team name and overtaken team", () => {
    render(<RaceFeedRemontadaCard data={data} />);
    expect(screen.getByText(/Pelu's Crew/)).toBeInTheDocument();
    expect(screen.getByText(/Overtook bigdaddy in the rankings/)).toBeInTheDocument();
  });

  it("renders multiplier as ×N format", () => {
    render(<RaceFeedRemontadaCard data={data} />);
    expect(screen.getByText(/×2 XP boost for the next 3 stages/)).toBeInTheDocument();
  });

  it("renders singular 'stage' when only 1 stage remaining", () => {
    render(<RaceFeedRemontadaCard data={{ ...data, stagesRemaining: 1 }} />);
    expect(screen.getByText(/×2 XP boost for the next 1 stage\b/)).toBeInTheDocument();
  });

  it("omits overtaken line when overtakenTeamName is null", () => {
    render(<RaceFeedRemontadaCard data={{ ...data, overtakenTeamName: null }} />);
    expect(screen.queryByText(/Overtook/)).not.toBeInTheDocument();
  });
});
