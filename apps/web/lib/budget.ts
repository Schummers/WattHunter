/** Bid increment shared across all bid UIs (Rider Detail, DraftBidCard) */
export const BID_INCREMENT = 100;

/** Available budget = treasury minus committed draft bids */
export function computeAvailableBudget(
  treasury: number,
  sponsorIncome: number,
  activeSalaries: number,
  draftBidsTotal: number,
): number {
  return treasury + sponsorIncome - activeSalaries - draftBidsTotal;
}
