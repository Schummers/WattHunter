// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { CopyInput } from "../copy-input";

function mockClipboard(impl: (text: string) => Promise<void>) {
  const writeText = vi.fn(impl);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

async function flush() {
  // Resolve any pending microtasks queued by `await writeText(...)` inside the
  // component's click handler.
  await act(async () => {
    await Promise.resolve();
  });
}

describe("CopyInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("exposes the aria-labels on the input and copy button", () => {
    mockClipboard(async () => undefined);

    render(
      <CopyInput
        value="ABC123"
        label="Invite code"
        copyButtonLabel="Copy invite code"
      />,
    );

    expect(screen.getByLabelText("Invite code")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy invite code" }),
    ).toBeInTheDocument();
  });

  it("swaps the icon to a check after a successful copy and reverts after the feedback window", async () => {
    const writeText = mockClipboard(async () => undefined);

    render(
      <CopyInput
        value="https://watthunter.app/league/join?code=ABC123"
        label="Invite link"
        copyButtonLabel="Copy invite link"
      />,
    );

    const button = screen.getByRole("button", { name: "Copy invite link" });
    expect(button.querySelector("svg")).toHaveClass("lucide-copy");

    fireEvent.click(button);
    await flush();

    expect(writeText).toHaveBeenCalledWith(
      "https://watthunter.app/league/join?code=ABC123",
    );
    expect(button.querySelector("svg")).toHaveClass("lucide-circle-check-big");

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(button.querySelector("svg")).toHaveClass("lucide-copy");
  });

  it("clears the pending revert timer when unmounted mid-window", async () => {
    mockClipboard(async () => undefined);
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");

    const { unmount } = render(
      <CopyInput
        value="ABC123"
        label="Invite code"
        copyButtonLabel="Copy invite code"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Copy invite code" }),
    );
    await flush();

    clearSpy.mockClear();
    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });

  it("swallows clipboard rejections silently and stays in the idle state", async () => {
    const writeText = mockClipboard(async () => {
      throw new Error("NotAllowedError");
    });

    render(
      <CopyInput
        value="ABC123"
        label="Invite code"
        copyButtonLabel="Copy invite code"
      />,
    );

    const button = screen.getByRole("button", { name: "Copy invite code" });

    fireEvent.click(button);
    await flush();

    expect(writeText).toHaveBeenCalledTimes(1);
    // No icon swap because the write rejected.
    expect(button.querySelector("svg")).toHaveClass("lucide-copy");
  });
});
