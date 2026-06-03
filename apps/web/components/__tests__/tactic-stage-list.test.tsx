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

  it("renders the TT badge for ITT/TTT stages regardless of blockTimeTrials", () => {
    const onChange = vi.fn();
    const ttt = makeStage({
      slug: "race/dauphine/2026/stage-3",
      stageType: "TTT",
    });
    const itt = makeStage({
      slug: "race/tour-de-france/2026/stage-16",
      stageType: "ITT",
    });
    render(
      <StageList stages={[ttt, itt]} value="" onChange={onChange} />,
    );
    expect(screen.getByTestId(`tt-badge-${ttt.slug}`)).toHaveTextContent("TTT");
    expect(screen.getByTestId(`tt-badge-${itt.slug}`)).toHaveTextContent("ITT");
  });

  it("omits the TT badge for RR stages", () => {
    const onChange = vi.fn();
    const rr = makeStage({ stageType: "RR" });
    render(
      <StageList stages={[rr]} value="" onChange={onChange} />,
    );
    expect(screen.queryByTestId(`tt-badge-${rr.slug}`)).not.toBeInTheDocument();
  });

  it("blockTimeTrials=true disables ITT/TTT stages and surfaces 'Time trial'", () => {
    const onChange = vi.fn();
    const stage = makeStage({
      slug: "race/dauphine/2026/stage-3",
      stageType: "TTT",
    });
    render(
      <StageList
        stages={[stage]}
        value=""
        onChange={onChange}
        blockTimeTrials
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(screen.getByTestId(`tt-blocked-${stage.slug}`)).toHaveTextContent(
      /time trial/i,
    );
    fireEvent.click(btn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("blockTimeTrials=false keeps ITT/TTT stages enabled (badge still shown)", () => {
    const onChange = vi.fn();
    const stage = makeStage({
      slug: "race/dauphine/2026/stage-3",
      stageType: "TTT",
    });
    render(
      <StageList
        stages={[stage]}
        value=""
        onChange={onChange}
        // blockTimeTrials omitted → falsy
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn).not.toBeDisabled();
    expect(screen.getByTestId(`tt-badge-${stage.slug}`)).toBeInTheDocument();
    expect(
      screen.queryByTestId(`tt-blocked-${stage.slug}`),
    ).not.toBeInTheDocument();
  });
});
