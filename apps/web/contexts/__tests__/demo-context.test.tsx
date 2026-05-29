// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { DemoProvider, useDemo, useDemoSafeAction } from "../demo-context";

function PulseTarget() {
  const { registerPulseTarget } = useDemo();
  return <div data-testid="target" ref={(el) => registerPulseTarget(el)} />;
}

function ActionButton({ onAct }: { onAct: () => Promise<unknown> }) {
  const safe = useDemoSafeAction(onAct);
  return (
    <button
      onClick={() => {
        void safe();
      }}
    >
      go
    </button>
  );
}

describe("DemoProvider + useDemoSafeAction", () => {
  it("triggers a pulse and short-circuits the action in demo mode", async () => {
    const onAct = vi.fn(async () => "ran");
    render(
      <DemoProvider visitorTeamId="t-2">
        <PulseTarget />
        <ActionButton onAct={onAct} />
      </DemoProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });

    expect(onAct).not.toHaveBeenCalled();
    expect(screen.getByTestId("target").className).toContain("demo-pulse");
  });

  it("calls the action verbatim outside demo mode", async () => {
    const onAct = vi.fn(async () => "ran");
    render(<ActionButton onAct={onAct} />);

    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });

    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it("re-arms the pulse class on repeat triggers", async () => {
    const onAct = vi.fn(async () => "ran");
    render(
      <DemoProvider visitorTeamId="t-2">
        <PulseTarget />
        <ActionButton onAct={onAct} />
      </DemoProvider>,
    );
    const target = screen.getByTestId("target");

    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });
    expect(target.className).toContain("demo-pulse");

    target.classList.remove("demo-pulse");
    await act(async () => {
      fireEvent.click(screen.getByText("go"));
    });
    expect(target.className).toContain("demo-pulse");
  });
});
