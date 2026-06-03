/** Bid increment shared across all bid UIs (Rider Detail, DraftBidCard) */
export const BID_INCREMENT = 1000;

/** Snap a value to the nearest multiple of BID_INCREMENT, enforcing a floor. */
export function snapToIncrement(value: number, min: number): number {
  return Math.max(min, Math.round(value / BID_INCREMENT) * BID_INCREMENT);
}

/**
 * Available budget for bidding.
 *
 * When the phase is already confirmed (payday ran after Round 1),
 * treasury already includes sponsor income minus salaries —
 * so we only subtract pending draft bids.
 *
 * Before phase confirmation (during Round 1), treasury is the
 * previous-phase balance and we must project sponsor/salaries.
 */
export function computeAvailableBudget(
  treasury: number,
  sponsorIncome: number,
  activeSalaries: number,
  draftBidsTotal: number,
  phaseConfirmed: boolean = false,
): number {
  if (phaseConfirmed) {
    return treasury - draftBidsTotal;
  }
  return treasury + sponsorIncome - activeSalaries - draftBidsTotal;
}
