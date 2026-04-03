"use client";

import { formatThousands } from "@/lib/format";
import { computeAvailableBudget } from "@/lib/budget";

interface BudgetSummaryProps {
  treasury: number;
  sponsorIncome: number;
  activeSalaries: number;
  draftBidsTotal: number;
  draftCount: number;
}

export function BudgetSummary({
  treasury,
  sponsorIncome,
  activeSalaries,
  draftBidsTotal,
  draftCount,
}: BudgetSummaryProps) {
  const remaining = computeAvailableBudget(
    treasury,
    sponsorIncome,
    activeSalaries,
    draftBidsTotal
  );
  const isDeficit = remaining < 0;

  return (
    <div
      className={`rounded-lg border bg-[var(--bg-surface)] px-3 py-[10px] transition-colors ${
        isDeficit ? "border-red-500/30" : "border-[var(--border-default)]"
      }`}
    >
      {/* Treasury */}
      <div className="flex items-center justify-between py-[3px]">
        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          Treasury
        </span>
        <span className="font-mono text-[length:var(--type-caption)] text-[var(--accent-highlight)]">
          €{formatThousands(treasury)}
        </span>
      </div>

      {/* Sponsor Income */}
      <div className="flex items-center justify-between py-[3px]">
        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          Upcoming Sponsor
        </span>
        <span className="font-mono text-[length:var(--type-caption)] text-[#4ade80]">
          +€{formatThousands(sponsorIncome)}
        </span>
      </div>

      {/* Active Salaries */}
      <div className="flex items-center justify-between py-[3px]">
        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          Active Roster Payroll
        </span>
        <span className="font-mono text-[length:var(--type-caption)] text-red-400">
          −€{formatThousands(activeSalaries)}
        </span>
      </div>

      {/* Draft bids */}
      <div className="flex items-center justify-between py-[3px]">
        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          Draft bids ({draftCount})
        </span>
        <span className="font-mono text-[length:var(--type-caption)] text-red-400">
          −€{formatThousands(draftBidsTotal)}
        </span>
      </div>

      {/* Divider */}
      <div className="my-1 h-px bg-[var(--border-default)]" />

      {/* Total row */}
      <div className="flex items-center justify-between pt-1">
        <span
          className={`text-[length:var(--type-emphasis)] font-semibold ${
            isDeficit ? "text-red-400" : "text-[var(--text-high)]"
          }`}
        >
          {isDeficit ? "Deficit" : "Purchasing Power"}
        </span>
        <span
          className={`font-mono text-[length:var(--type-stat-small)] font-bold ${
            isDeficit ? "text-red-400" : "text-[var(--accent-highlight)]"
          }`}
        >
          {isDeficit ? "−" : ""}€{formatThousands(Math.abs(remaining))}
        </span>
      </div>
    </div>
  );
}
