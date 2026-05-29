// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LaunchButton } from "../launch-button";

vi.mock("@/app/(game)/league/[leagueId]/actions", () => ({
  launchFirstAuction: vi.fn(async () => ({ success: true })),
}));

describe("LaunchButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the waiting copy for non-commissioners", () => {
    render(
      <LaunchButton
        leagueId="00000000-0000-4000-8000-000000000001"
        isCommissioner={false}
        memberCount={3}
      />
    );
    expect(
      screen.getByText("Waiting for the Race Director to start the auction.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Launch/ })).toBeNull();
  });

  it("renders the launch button for the commissioner", () => {
    render(
      <LaunchButton
        leagueId="00000000-0000-4000-8000-000000000001"
        isCommissioner
        memberCount={3}
      />
    );
    const btn = screen.getByRole("button", { name: /Launch first auction/ });
    expect(btn).toBeEnabled();
  });

  it("disables the button when no members have joined", () => {
    render(
      <LaunchButton
        leagueId="00000000-0000-4000-8000-000000000001"
        isCommissioner
        memberCount={0}
      />
    );
    expect(
      screen.getByRole("button", { name: /Launch first auction/ })
    ).toBeDisabled();
  });
});
