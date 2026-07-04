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

  it("subtracts roster payroll from the flat ceiling (Round 2+ scenario)", () => {
    // 2M ceiling − 1.106M roster − 607K drafts = 287K remaining
    render(
      <BudgetSummary
        treasury={2_000_000}
        sponsorIncome={0}
        activeSalaries={1_106_000}
        draftBidsTotal={607_000}
        draftCount={2}
        mode="classic"
      />
    );
    expect(screen.getByText(/Roster payroll/i)).toBeInTheDocument();
    // Remaining should be the true spendable amount, not 2M − drafts (1.39M)
    expect(screen.getByText("€287k")).toBeInTheDocument();
    expect(screen.queryByText("€1.39M")).toBeNull();
  });

  it("hides the roster payroll line when the squad is empty (Round 1)", () => {
    render(
      <BudgetSummary
        treasury={2_000_000}
        sponsorIncome={0}
        activeSalaries={0}
        draftBidsTotal={300_000}
        draftCount={3}
        mode="classic"
      />
    );
    expect(screen.queryByText(/Roster payroll/i)).toBeNull();
  });
});
