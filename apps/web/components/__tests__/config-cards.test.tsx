// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ConfigCards } from "../config-cards";

describe("ConfigCards by mode", () => {
  it("renders nothing in classic", () => {
    const { container } = render(
      <ConfigCards
        leagueId="league-1"
        sponsorName="Test Sponsor"
        sponsorBudget={250_000}
        strategies={[]}
        maxStrategies={2}
        isEditable={false}
        mode="classic"
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
