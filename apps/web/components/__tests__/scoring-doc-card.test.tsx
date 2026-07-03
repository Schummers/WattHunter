// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ScoringDocCard } from "../scoring-doc-card";

describe("ScoringDocCard", () => {
  it("renders the summary headline and subtitle", () => {
    render(<ScoringDocCard />);
    expect(screen.getByText("How scoring works")).toBeInTheDocument();
    expect(
      screen.getByText(/Stage points, daily bonuses, final classifications/i),
    ).toBeInTheDocument();
  });

  it("renders the 4 block headings", () => {
    render(<ScoringDocCard />);
    for (const name of [
      "1 · Stage points",
      "2 · Daily bonus",
      "3 · Final classifications",
      "4 · Roles",
    ]) {
      expect(screen.getByRole("heading", { name, level: 3 })).toBeInTheDocument();
    }
  });

  it("renders the stage points scale", () => {
    render(<ScoringDocCard />);
    expect(screen.getByText("1st")).toBeInTheDocument();
    expect(screen.getByText("80 / 70")).toBeInTheDocument();
    expect(screen.getByText("20th (last scoring place)")).toBeInTheDocument();
  });

  it("renders the GC final winner value", () => {
    render(<ScoringDocCard />);
    expect(screen.getByText("GC (top 30)")).toBeInTheDocument();
    expect(screen.getByText("250 → 1")).toBeInTheDocument();
  });

  it("renders every role", () => {
    render(<ScoringDocCard />);
    for (const role of [
      "GC Leader",
      "Sprinter",
      "Climber",
      "TT Specialist",
      "Stage Hunter",
      "Underdog",
      "Domestique",
    ]) {
      expect(screen.getByText(role)).toBeInTheDocument();
    }
  });

  it("mentions domestique assists and Nemesis", () => {
    render(<ScoringDocCard />);
    // "assists" and "Nemesis" are wrapped in <b>, so match those exact nodes.
    expect(screen.getByText("assists")).toBeInTheDocument();
    expect(screen.getByText("Nemesis")).toBeInTheDocument();
  });
});
