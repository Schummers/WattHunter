// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BudgetSummary } from "../budget-summary";

describe("BudgetSummary classic", () => {
  it("shows flat budget and hides sponsor income line", () => {
    render(
      <BudgetSummary
        treasury={1_500_000}
        sponsorIncome={0}
        activeSalaries={0}
        draftBidsTotal={300_000}
        draftCount={3}
        mode="classic"
      />
    );
    expect(screen.queryByText(/Sponsor/i)).toBeNull();
    expect(screen.getByText(/Remaining/i)).toBeInTheDocument();
  });
});
