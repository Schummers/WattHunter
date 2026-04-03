import { cn } from "@/lib/utils";
import { computeAvailableBudget } from "@/lib/budget";

interface TreasuryWidgetProps {
  treasury: number;
  sponsorIncome: number;
  activeSalaries: number;
  activeBidsTotal: number;
}

export function TreasuryWidget({
  treasury,
  sponsorIncome,
  activeSalaries,
  activeBidsTotal,
}: TreasuryWidgetProps) {
  const available = computeAvailableBudget(
    treasury,
    sponsorIncome,
    activeSalaries,
    activeBidsTotal
  );

  return (
    <div className="sticky top-0 z-10 flex items-center gap-8 border-b border-[var(--border-default)] bg-[var(--bg-surface)] py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">Treasury</span>
        <span className="text-[length:var(--type-body)] font-semibold text-[var(--text-high)]">
          {treasury.toLocaleString("en-US")} EUR
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">Active bids</span>
        <span className="text-[length:var(--type-body)] font-semibold text-[var(--text-high)]">
          {activeBidsTotal.toLocaleString("en-US")} EUR
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">Available budget</span>
        <span
          className={cn(
            "text-[length:var(--type-body)] font-semibold",
            available >= 50_000 ? "text-[var(--success)]" : "text-[var(--status-danger)]"
          )}
        >
          {available.toLocaleString("en-US")} EUR
        </span>
      </div>
    </div>
  );
}
