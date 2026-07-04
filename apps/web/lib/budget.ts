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

/**
 * Available budget for bidding in Classic mode.
 *
 * Classic treasury is a flat per-phase ceiling that is never decremented on
 * purchase — roster spend lives in `contracts.locked_salary` and pending picks
 * in draft/auction bids. Spendable is therefore the ceiling minus payroll minus
 * pending bids. Mirrors the place_bid solvency rule
 * (contracts + active bids <= treasury). Unlike manager mode there is no sponsor
 * income and no phase-confirmation gating.
 */
export function computeClassicBudget(
  treasury: number,
  activeSalaries: number,
  draftBidsTotal: number,
): number {
  return treasury - activeSalaries - draftBidsTotal;
}
