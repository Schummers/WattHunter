// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StageList } from "../tactic-stage-list";
import type { GtStage } from "@/lib/gt-stages";

function makeStage(overrides: Partial<GtStage> = {}): GtStage {
  return {
    number: 1,
    date: "2026-07-04",
    slug: "race/tour-de-france/2026/stage-1",
    status: "upcoming",
    profileIcon: "p1",
    ...overrides,
  };
}

describe("StageList", () => {
  it("renders the profile chip when profileIcon is set", () => {
    const onChange = vi.fn();
    render(
      <StageList
        stages={[makeStage({ profileIcon: "p1" })]}
        value=""
        onChange={onChange}
      />,
    );
    expect(screen.getByText("p1")).toBeInTheDocument();
  });

  it("omits the profile chip when profileIcon is null and no requiredProfiles", () => {
    const onChange = vi.fn();
    render(
      <StageList
        stages={[makeStage({ profileIcon: null })]}
        value=""
        onChange={onChange}
      />,
    );
    expect(screen.queryByText(/^p[0-5]$/)).not.toBeInTheDocument();
  });

  it("disables the radio when profile does not match requiredProfiles", () => {
    const onChange = vi.fn();
    const stage = makeStage({
      slug: "race/tour-de-france/2026/stage-12",
      profileIcon: "p5",
    });
    render(
      <StageList
        stages={[stage]}
        value=""
        onChange={onChange}
        requiredProfiles={new Set(["p1", "p2", "p3"])}
      />,
    );

    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(
      screen.getByTestId(`profile-mismatch-${stage.slug}`),
    ).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables the radio when profileIcon is null but requiredProfiles is set", () => {
    const onChange = vi.fn();
    const stage = makeStage({ profileIcon: null });
    render(
      <StageList
        stages={[stage]}
        value=""
        onChange={onChange}
        requiredProfiles={new Set(["p1", "p2", "p3"])}
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("keeps the row enabled when profile matches requiredProfiles", () => {
    const onChange = vi.fn();
    const stage = makeStage({ profileIcon: "p2" });
    render(
      <StageList
        stages={[stage]}
        value=""
        onChange={onChange}
        requiredProfiles={new Set(["p1", "p2", "p3"])}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onChange).toHaveBeenCalledWith(stage.slug);
  });
});
