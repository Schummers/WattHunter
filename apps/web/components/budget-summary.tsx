"use client";

import { formatMoney } from "@/lib/format";
import { computeAvailableBudget, computeClassicBudget } from "@/lib/budget";
import { type LeagueMode, isClassic } from "@/lib/league-mode";

interface BudgetSummaryProps {
  treasury: number;
  sponsorIncome: number;
  activeSalaries: number;
  draftBidsTotal: number;
  draftCount: number;
  phaseConfirmed?: boolean;
  mode?: LeagueMode;
}

export function BudgetSummary({
  treasury,
  sponsorIncome,
  activeSalaries,
  draftBidsTotal,
  draftCount,
  phaseConfirmed = false,
  mode,
}: BudgetSummaryProps) {
  // Classic mode: flat per-phase ceiling. Treasury is never decremented on
  // purchase, so remaining = ceiling minus roster payroll minus pending drafts.
  if (isClassic(mode)) {
    const remaining = computeClassicBudget(treasury, activeSalaries, draftBidsTotal);
    const isDeficit = remaining < 0;

    return (
      <div
        className={`rounded-lg border bg-[var(--bg-surface)] px-3 py-[10px] transition-colors ${
          isDeficit ? "border-[var(--danger-border)]" : "border-[var(--border-default)]"
        }`}
      >
        {/* Budget */}
        <div className="flex items-center justify-between py-[3px]">
          <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
            Budget
          </span>
          <span className="font-mono text-[length:var(--type-caption)] text-[var(--accent-highlight)]">
            {formatMoney(treasury)}
          </span>
        </div>

        {/* Roster payroll — recurring salaries of the active squad */}
        {activeSalaries > 0 && (
          <div className="flex items-center justify-between py-[3px]">
            <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
              Roster payroll
            </span>
            <span className="font-mono text-[length:var(--type-caption)] text-red-400">
              −{formatMoney(activeSalaries)}
            </span>
          </div>
        )}

        {/* Spent — pending draft bids */}
        <div className="flex items-center justify-between py-[3px]">
          <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
            Draft bids ({draftCount})
          </span>
          <span className="font-mono text-[length:var(--type-caption)] text-red-400">
            −{formatMoney(draftBidsTotal)}
          </span>
        </div>

        {/* Divider */}
        <div className="my-1 h-px bg-[var(--border-default)]" />

        {/* Remaining row */}
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
            {isDeficit ? "−" : ""}{formatMoney(Math.abs(remaining))}
          </span>
        </div>
      </div>
    );
  }

  const remaining = computeAvailableBudget(
    treasury,
    sponsorIncome,
    activeSalaries,
    draftBidsTotal,
    phaseConfirmed
  );
  const isDeficit = remaining < 0;

  return (
    <div
      className={`rounded-lg border bg-[var(--bg-surface)] px-3 py-[10px] transition-colors ${
        isDeficit ? "border-[var(--danger-border)]" : "border-[var(--border-default)]"
      }`}
    >
      {/* Treasury */}
      <div className="flex items-center justify-between py-[3px]">
        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          Treasury
        </span>
        <span className="font-mono text-[length:var(--type-caption)] text-[var(--accent-highlight)]">
          {formatMoney(treasury)}
        </span>
      </div>

      {/* Sponsor Income — only shown before phase confirmation (Round 1) */}
      {!phaseConfirmed && (
        <div className="flex items-center justify-between py-[3px]">
          <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
            Upcoming Sponsor
          </span>
          <span className="font-mono text-[length:var(--type-caption)] text-[var(--success)]">
            +{formatMoney(sponsorIncome)}
          </span>
        </div>
      )}

      {/* Active Salaries — only shown before phase confirmation (Round 1) */}
      {!phaseConfirmed && (
        <div className="flex items-center justify-between py-[3px]">
          <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
            Active Roster Payroll
          </span>
          <span className="font-mono text-[length:var(--type-caption)] text-red-400">
            −{formatMoney(activeSalaries)}
          </span>
        </div>
      )}

      {/* Draft bids */}
      <div className="flex items-center justify-between py-[3px]">
        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          Draft bids ({draftCount})
        </span>
        <span className="font-mono text-[length:var(--type-caption)] text-red-400">
          −{formatMoney(draftBidsTotal)}
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
          {isDeficit ? "−" : ""}{formatMoney(Math.abs(remaining))}
        </span>
      </div>
    </div>
  );
}
