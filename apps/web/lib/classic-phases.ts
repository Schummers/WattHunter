import { AUCTION_PHASES, getCurrentPhase, getNextPhase, type AuctionPhase } from "./phases";

// "Classics Part 2" (id=3) is the Classics block in Classic League mode.
// We use "Part 2" to avoid matching "Classics Part 1" (id=2) which is excluded.
const CLASSICS_BLOCK_ID =
  AUCTION_PHASES.find((p) => /classics?\s+part\s+2/i.test(p.label))?.id ?? 3;

export const CLASSIC_PHASE_IDS: number[] = [CLASSICS_BLOCK_ID, 4, 6, 8];

export function isClassicPhaseId(id: number): boolean {
  return CLASSIC_PHASE_IDS.includes(id);
}

export function getCurrentClassicPhase(date = new Date()): AuctionPhase | null {
  const p = getCurrentPhase(date);
  return p && isClassicPhaseId(p.id) ? p : null;
}

export function getNextClassicPhase(date = new Date()): AuctionPhase | null {
  // getNextPhase takes a phase object, not a date.
  // Walk forward through phases until we find a classic one.
  let p: AuctionPhase | null = getNextPhase(getCurrentPhase(date));
  while (p && !isClassicPhaseId(p.id)) {
    p = getNextPhase(p);
  }
  return p ?? null;
}
