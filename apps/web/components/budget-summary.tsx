"use client";

import { formatThousands } from "@/lib/format";

interface BudgetSummaryProps {
  sponsorIncome: number;
  rosterSalaries: number;
  rosterCount: number;
  draftBidsTotal: number;
  draftCount: number;
}

export function BudgetSummary({
  sponsorIncome,
  rosterSalaries,
  rosterCount,
  draftBidsTotal,
  draftCount,
}: BudgetSummaryProps) {
  const remaining = sponsorIncome - rosterSalaries - draftBidsTotal;
  const isDeficit = remaining < 0;

  return (
    <div
      className={`rounded-lg border bg-[var(--bg-surface)] px-3 py-[10px] transition-colors ${
        isDeficit ? "border-red-500/30" : "border-[var(--border-default)]"
      }`}
    >
      {/* Sponsor income */}
      <div className="flex items-center justify-between py-[3px]">
        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          Sponsor income
        </span>
        <span className="font-mono text-[length:var(--type-caption)] text-[var(--accent-highlight)]">
          +€{formatThousands(sponsorIncome)}
        </span>
      </div>

      {/* Roster salaries */}
      <div className="flex items-center justify-between py-[3px]">
        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          Roster salaries ({rosterCount})
        </span>
        <span className="font-mono text-[length:var(--type-caption)] text-red-400">
          −€{formatThousands(rosterSalaries)}
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
          {isDeficit ? "Deficit" : "Remaining"}
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
