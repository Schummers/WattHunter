import { cn } from "@/lib/utils";

interface TreasuryWidgetProps {
  treasury: number;
  activeBidsTotal: number;
}

export function TreasuryWidget({ treasury, activeBidsTotal }: TreasuryWidgetProps) {
  const available = treasury - activeBidsTotal;

  return (
    <div className="sticky top-0 z-10 flex items-center gap-8 border-b border-border bg-[var(--bg-surface)] py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-[var(--text-mid)]">Treasury</span>
        <span className="text-sm font-semibold text-[var(--text-high)]">
          {treasury.toLocaleString("en-US")} EUR
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-[var(--text-mid)]">Active bids</span>
        <span className="text-sm font-semibold text-[var(--text-high)]">
          {activeBidsTotal.toLocaleString("en-US")} EUR
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-[var(--text-mid)]">Available budget</span>
        <span
          className={cn(
            "text-sm font-semibold",
            available >= 50_000 ? "text-[var(--success)]" : "text-[var(--status-danger)]"
          )}
        >
          {available.toLocaleString("en-US")} EUR
        </span>
      </div>
    </div>
  );
}
