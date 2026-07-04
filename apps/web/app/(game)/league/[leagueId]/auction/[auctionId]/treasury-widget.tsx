import { cn } from "@/lib/utils";
import { computeAvailableBudget, computeClassicBudget } from "@/lib/budget";
import { type LeagueMode, isClassic } from "@/lib/league-mode";
import { formatMoney } from "@/lib/format";

interface TreasuryWidgetProps {
  treasury: number;
  sponsorIncome: number;
  activeSalaries: number;
  activeBidsTotal: number;
  phaseConfirmed?: boolean;
  mode?: LeagueMode;
}

export function TreasuryWidget({
  treasury,
  sponsorIncome,
  activeSalaries,
  activeBidsTotal,
  phaseConfirmed = false,
  mode,
}: TreasuryWidgetProps) {
  const available = isClassic(mode)
    ? computeClassicBudget(treasury, activeSalaries, activeBidsTotal)
    : computeAvailableBudget(
        treasury,
        sponsorIncome,
        activeSalaries,
        activeBidsTotal,
        phaseConfirmed
      );

  return (
    <div className="sticky top-0 z-10 flex items-center gap-8 border-b border-[var(--border-default)] bg-[var(--bg-surface)] py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">Treasury</span>
        <span className="text-[length:var(--type-body)] font-semibold font-mono tabular-nums text-[var(--text-high)]">
          {formatMoney(treasury)}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">Active bids</span>
        <span className="text-[length:var(--type-body)] font-semibold font-mono tabular-nums text-[var(--text-high)]">
          {formatMoney(activeBidsTotal)}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">Available budget</span>
        <span
          className={cn(
            "text-[length:var(--type-body)] font-semibold font-mono tabular-nums",
            available >= 50_000 ? "text-[var(--success)]" : "text-[var(--status-danger)]"
          )}
        >
          {formatMoney(available)}
        </span>
      </div>
    </div>
  );
}
