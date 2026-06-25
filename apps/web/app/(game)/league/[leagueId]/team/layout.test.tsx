// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TeamSubTabs } from "./layout";

// Mock next/navigation hooks used inside SubTabs (Link needs pathname)
vi.mock("next/navigation", () => ({
  usePathname: () => "/league/test-id/team/gt",
  useParams: () => ({ leagueId: "test-id" }),
  useRouter: () => ({ push: vi.fn() }),
}));

describe("Team sub-tabs by mode", () => {
  it("shows only Race Team in classic", () => {
    render(<TeamSubTabs leagueId="test-id" mode="classic" />);
    expect(screen.queryByText(/My Team/i)).toBeNull();
    expect(screen.queryByText(/Budget/i)).toBeNull();
  });

  it("shows My Team, Race Team, and Budget in manager mode", () => {
    render(<TeamSubTabs leagueId="test-id" mode="manager" />);
    expect(screen.getByText(/My Team/i)).toBeDefined();
    expect(screen.getByText(/Budget/i)).toBeDefined();
  });
});
