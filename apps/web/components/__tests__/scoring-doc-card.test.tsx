// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ScoringDocCard } from "../scoring-doc-card";

describe("ScoringDocCard", () => {
  it("renders the summary headline and subtitle", () => {
    render(<ScoringDocCard />);
    expect(screen.getByText("How scoring works")).toBeInTheDocument();
    expect(
      screen.getByText(/Role multipliers, finals, stage hunter/i),
    ).toBeInTheDocument();
  });

  it("renders all 6 section titles", () => {
    render(<ScoringDocCard />);
    expect(
      screen.getByRole("heading", { name: "Daily classifications", level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Final classifications", level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Stage Hunter", level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Sprinter", level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Underdog", level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Nemesis (tactic)", level: 3 }),
    ).toBeInTheDocument();
  });

  it("renders the Underdog rank-to-multiplier examples", () => {
    render(<ScoringDocCard />);
    expect(screen.getByText("PCS rank 200")).toBeInTheDocument();
    expect(screen.getByText("×2.0")).toBeInTheDocument();
    expect(screen.getByText("×3.0")).toBeInTheDocument();
  });

  it("renders the daily-classification 2-column table rows", () => {
    render(<ScoringDocCard />);
    expect(screen.getByText("GC daily (rider in top 10)")).toBeInTheDocument();
    expect(screen.getByText("Points daily (top 5)")).toBeInTheDocument();
    expect(screen.getByText("KOM daily (top 3)")).toBeInTheDocument();
    expect(screen.getByText("Youth daily (top 5)")).toBeInTheDocument();
  });

  it("renders the final-classification multipliers", () => {
    render(<ScoringDocCard />);
    // ×1.0 on GC final + ×2 / ×1.5 on the secondaries
    expect(screen.getAllByText("×2").length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText("×1.5").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("×1.0").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Nemesis profile chips", () => {
    render(<ScoringDocCard />);
    // The chips appear in both sprinter and nemesis sections; assert presence.
    expect(screen.getAllByText("p1").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("p4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("p5").length).toBeGreaterThanOrEqual(1);
  });
});
