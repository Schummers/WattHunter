// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LevelSelector } from "../level-selector";

describe("LevelSelector", () => {
  it("renders 8 levels with REC badge on the recommended one", () => {
    render(
      <LevelSelector
        selected={3}
        recommended={3}
        isCommissioner
        onSelect={vi.fn()}
      />
    );
    expect(screen.getAllByRole("radio")).toHaveLength(8);
    expect(
      screen.getByRole("radio", { name: "Level 3 (recommended)" })
    ).toHaveAttribute("aria-checked", "true");
  });

  it("calls onSelect when a commissioner clicks a different level", () => {
    const onSelect = vi.fn();
    render(
      <LevelSelector
        selected={3}
        recommended={3}
        isCommissioner
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: /Level 5/ }));
    expect(onSelect).toHaveBeenCalledWith(5);
  });

  it("does not fire onSelect for non-commissioners and disables the buttons", () => {
    const onSelect = vi.fn();
    render(
      <LevelSelector
        selected={3}
        recommended={3}
        isCommissioner={false}
        onSelect={onSelect}
      />
    );
    const level5 = screen.getByRole("radio", { name: /Level 5/ });
    expect(level5).toBeDisabled();
    fireEvent.click(level5);
    expect(onSelect).not.toHaveBeenCalled();
    expect(
      screen.getByText("Only the Race Director can change the starting level.")
    ).toBeInTheDocument();
  });
});
