// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DemoBanner } from "../demo-banner";
import { DemoProvider } from "@/contexts/demo-context";

describe("DemoBanner", () => {
  it("renders the copy and the Get Started CTA when wrapped in DemoProvider", () => {
    render(
      <DemoProvider visitorTeamId="t-2">
        <DemoBanner />
      </DemoProvider>,
    );
    expect(screen.getByText(/exploring a demo league/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /get started/i }),
    ).toHaveAttribute("href", "/");
  });

  it("renders nothing outside DemoProvider", () => {
    const { container } = render(<DemoBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
