// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TacticCard } from "../tactic-card";

describe("TacticCard", () => {
  const baseProps = {
    tacticId: "unleash" as const,
    used: 0,
    state: "available" as const,
    onClick: vi.fn(),
  };

  it("renders name, short description, and remaining count", () => {
    render(<TacticCard {...baseProps} />);
    expect(screen.getByText("Unleash")).toBeInTheDocument();
    expect(screen.getByText(/Domestiques/)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows Today badge when active_today", () => {
    render(<TacticCard {...baseProps} state="active_today" />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("disables button when exhausted", () => {
    render(<TacticCard {...baseProps} used={2} state="exhausted" />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("disables button when state=disabled with reason", () => {
    render(
      <TacticCard
        {...baseProps}
        tacticId="nemesis_gc"
        state="disabled"
        disabledReason="No eligible rival"
      />
    );
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByText("No eligible rival")).toBeInTheDocument();
  });
});
