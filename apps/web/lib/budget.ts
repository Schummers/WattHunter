/** Bid increment shared across all bid UIs (Rider Detail, DraftBidCard) */
export const BID_INCREMENT = 100;

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
