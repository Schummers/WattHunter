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
  daysRemaining: 3,
  triggeredAt: "2026-05-06",
};

describe("RaceFeedRemontadaCard", () => {
  it("renders team name and boost duration", () => {
    render(<RaceFeedRemontadaCard data={data} />);
    expect(screen.getByText(/Pelu's Crew/)).toBeInTheDocument();
    expect(screen.getByText(/3 jours/)).toBeInTheDocument();
  });

  it("renders multiplier as +N% format", () => {
    render(<RaceFeedRemontadaCard data={{ ...data, multiplier: 2.0 }} />);
    expect(screen.getByText(/\+100%/)).toBeInTheDocument();
  });

  it("renders multiplier 1.5 as +50%", () => {
    render(<RaceFeedRemontadaCard data={{ ...data, multiplier: 1.5 }} />);
    expect(screen.getByText(/\+50%/)).toBeInTheDocument();
  });

  it("renders singular 'jour' when only 1 day remaining", () => {
    render(<RaceFeedRemontadaCard data={{ ...data, daysRemaining: 1 }} />);
    expect(screen.getByText(/1 jour\b/)).toBeInTheDocument();
  });
});
