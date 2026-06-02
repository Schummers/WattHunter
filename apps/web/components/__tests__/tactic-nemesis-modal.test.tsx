// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

// Hoisted mocks for the modal-render test (must be in scope before imports).
const { mockPlaceTactic } = vi.hoisted(() => ({
  mockPlaceTactic: vi.fn(),
}));

vi.mock(
  "@/app/(game)/league/[leagueId]/team/gt/tactics/actions",
  () => ({ placeTactic: mockPlaceTactic }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/contexts/demo-context", () => ({
  useDemoSafeAction: <TArgs extends unknown[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
  ) => fn,
}));

import {
  mapNemesisErrorMessage,
  TacticNemesisModal,
  type EligibleRival,
} from "../tactic-nemesis-modal";
import type { GtStage } from "@/lib/gt-stages";

describe("mapNemesisErrorMessage", () => {
  it("maps 'stage profile unknown' to the operator-friendly hint", () => {
    const out = mapNemesisErrorMessage(
      "stage profile unknown for race/tour-de-france/2026/stage-3 — run the startlists pipeline first",
      "nemesis_sprint",
    );
    expect(out).toMatch(/profile for that stage yet/i);
    expect(out).toMatch(/startlists pipeline/i);
  });

  it("maps the Nemesis Sprint mismatch to a friendly string", () => {
    const out = mapNemesisErrorMessage(
      "Nemesis Sprint requires a flat or hilly stage (p1/p2/p3), got p5",
      "nemesis_sprint",
    );
    expect(out).toMatch(/flat or hilly/i);
    expect(out).toMatch(/p1\/p2\/p3/);
  });

  it("maps the Nemesis GC mismatch to a friendly string", () => {
    const out = mapNemesisErrorMessage(
      "Nemesis GC requires a hilly-uphill or mountain stage (p3/p4/p5), got p1",
      "nemesis_gc",
    );
    expect(out).toMatch(/hilly-uphill or mountain/i);
    expect(out).toMatch(/p3\/p4\/p5/);
  });

  it("falls back to the raw message when nothing matches", () => {
    const out = mapNemesisErrorMessage(
      "tactic cutoff has passed for today stage",
      "nemesis_gc",
    );
    expect(out).toBe("tactic cutoff has passed for today stage");
  });
});

describe("TacticNemesisModal", () => {
  beforeEach(() => {
    mockPlaceTactic.mockReset();
  });

  it("renders the friendly mapped error when place_tactic throws a known string", async () => {
    mockPlaceTactic.mockRejectedValueOnce(
      new Error(
        "Nemesis Sprint requires a flat or hilly stage (p1/p2/p3), got p5",
      ),
    );

    const rival: EligibleRival = {
      teamId: "team-rival",
      teamName: "Rival Team",
      leader: { riderId: "r1", name: "Sprinter Rival" },
      xp: 1234,
    };
    // Use p2 so the stage list itself stays enabled (gate already permits it);
    // the server then rejects — we want to verify the modal maps that response.
    const stage: GtStage = {
      number: 4,
      date: "2026-07-08",
      slug: "race/tour-de-france/2026/stage-4",
      status: "upcoming",
      profileIcon: "p2",
    };

    render(
      <TacticNemesisModal
        tacticId="nemesis_sprint"
        used={0}
        teamId="team-self"
        phaseId={6}
        year={2026}
        stages={[stage]}
        eligibleRivals={[rival]}
        myLeader={{ name: "My Sprinter", xp: 1000 }}
        onClose={vi.fn()}
      />,
    );

    // Step 1 → pick the rival, advance to step 2.
    fireEvent.click(screen.getByText("Rival Team"));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    // Step 2 → pick the (compatible) stage, click Declare.
    fireEvent.click(screen.getByText("Stage 4"));
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /declare nemesis/i }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/flat or hilly/i)).toBeInTheDocument();
    });
    // And it does NOT render the raw server string.
    expect(
      screen.queryByText(/got p5/i),
    ).not.toBeInTheDocument();
  });
});
