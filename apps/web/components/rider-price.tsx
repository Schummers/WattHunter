import { formatMoney } from "@/lib/format";

interface RiderPriceProps {
  /** Full acquisition price (min salary / bid floor). */
  amount: number;
  /**
   * Optional reduced price (e.g. underdog −50%, future Spec B).
   * When set and lower than `amount`, the full price is struck through and the
   * reduced price is shown next to it ("€52k → €26k").
   */
  reducedAmount?: number | null;
  className?: string;
}

/**
 * Unified rider acquisition price display (min salary / bid floor).
 * Numbers use Geist Mono + tabular-nums per the design system.
 * The reduced-price mode is wired but unused until the underdog discount (Spec B) ships.
 */
export function RiderPrice({ amount, reducedAmount, className }: RiderPriceProps) {
  const hasReduction = reducedAmount != null && reducedAmount < amount;

  return (
    <span className={`font-mono tabular-nums${className ? ` ${className}` : ""}`}>
      {hasReduction ? (
        <>
          <span className="text-[var(--text-mid)] line-through">{formatMoney(amount)}</span>
          <span className="mx-1 text-[var(--text-mid)]">→</span>
          <span className="text-[var(--text-high)]">{formatMoney(reducedAmount)}</span>
        </>
      ) : (
        formatMoney(amount)
      )}
    </span>
  );
}
