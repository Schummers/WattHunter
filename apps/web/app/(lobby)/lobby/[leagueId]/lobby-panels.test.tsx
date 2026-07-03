// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LobbyPanels } from "./lobby-panels";

// Mock child components that may have server-only imports or complex deps
vi.mock("./_components/auction-explainer", () => ({
  AuctionExplainer: () => <div>AuctionExplainer</div>,
}));
vi.mock("./_components/game-loop-explainer", () => ({
  GameLoopExplainer: () => <div>GameLoopExplainer</div>,
}));
vi.mock("./_components/invite-section", () => ({
  InviteSection: () => <div>InviteSection</div>,
}));
vi.mock("./_components/launch-button", () => ({
  LaunchButton: () => <div>LaunchButton</div>,
}));
vi.mock("./_components/level-selector", () => ({
  LevelSelector: () => <div>LevelSelector</div>,
}));
vi.mock("./_components/level-stats-cards", () => ({
  LevelStatsCards: () => <div>LevelStatsCards</div>,
}));
vi.mock("./_components/player-list", () => ({
  PlayerList: () => <div>PlayerList</div>,
}));
vi.mock("./_components/rider-pool-list", () => ({
  RiderPoolList: () => <div>RiderPoolList</div>,
}));
vi.mock("./actions", () => ({
  setStartingLevel: vi.fn(async () => ({ ok: true })),
}));

describe("LobbyPanels tabs by mode", () => {
  const base = {
    league: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Test League",
      invite_code: "ABC123",
      commissioner_id: "00000000-0000-4000-8000-000000000002",
      max_players: 20,
      starting_level: 1,
    },
    members: [],
    memberCount: 0,
    recommendedLevel: 1,
    isCommissioner: false,
    riders: [],
  } as any;

  it("hides Level & Pool in classic mode", () => {
    render(<LobbyPanels {...base} mode="classic" />);
    expect(screen.queryByText(/Level & Pool/i)).toBeNull();
  });

  it("shows Level & Pool in manager mode", () => {
    render(<LobbyPanels {...base} mode="manager" />);
    expect(screen.getByText(/Level & Pool/i)).toBeInTheDocument();
  });
});
