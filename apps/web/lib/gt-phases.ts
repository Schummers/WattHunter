import { AUCTION_PHASES, getCurrentPhase, type AuctionPhase } from "./phases";

export const GT_PHASE_IDS = [4, 6, 8] as const;
export type GtPhaseId = (typeof GT_PHASE_IDS)[number];

/**
 * Dev override — if `NEXT_PUBLIC_DEV_GT_FORCE_DATE` is set (e.g. "2026-05-15"),
 * all GT helpers below act as if today were that date. Leave unset in prod.
 */
function resolveDate(date: Date): Date {
  const override = process.env.NEXT_PUBLIC_DEV_GT_FORCE_DATE;
  if (override) {
    const parsed = new Date(override);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return date;
}

/** Canonical race-slug prefix per GT phase (used to scope XP / bonus queries). */
export const GT_RACE_SLUG_PREFIX: Record<GtPhaseId, string> = {
  4: "race/giro-d-italia",
  6: "race/tour-de-france",
  8: "race/vuelta-a-espana",
};

/** Full display name — `Giro d'Italia` / `Tour de France` / `La Vuelta`. */
export const GT_FULL_NAME: Record<GtPhaseId, string> = {
  4: "Giro d'Italia",
  6: "Tour de France",
  8: "La Vuelta",
};

/** Short label used in the GT Team sub-tab and section titles. */
export const GT_SHORT_NAME: Record<GtPhaseId, string> = {
  4: "Giro",
  6: "Tour",
  8: "Vuelta",
};

export function isGTPhaseId(id: number): id is GtPhaseId {
  return (GT_PHASE_IDS as readonly number[]).includes(id);
}

/** Returns the current GT phase if we're inside one, otherwise null. */
export function getCurrentGTPhase(date: Date = new Date()): AuctionPhase | null {
  const effective = resolveDate(date);
  const phase = getCurrentPhase(effective);
  return isGTPhaseId(phase.id) ? phase : null;
}

/** Returns the next GT phase (strictly after `date`), or null if all 3 are past. */
export function getNextGTPhase(date: Date = new Date()): AuctionPhase | null {
  const effective = resolveDate(date);
  const year = effective.getFullYear();
  for (const p of AUCTION_PHASES) {
    if (!isGTPhaseId(p.id)) continue;
    const start = new Date(year, p.startMonth - 1, p.startDay);
    if (start > effective) return p;
  }
  return null;
}

/**
 * Sub-tab label for the Team layout:
 *   - During a GT phase → `Giro Team` / `Tour Team` / `Vuelta Team`
 *   - Outside           → `GT Team` (inactive placeholder)
 */
export function getGTSubTabLabel(date: Date = new Date()): string {
  const cur = getCurrentGTPhase(date);
  if (!cur) return "GT Team";
  return `${GT_SHORT_NAME[cur.id as GtPhaseId]} Team`;
}

/** Home banner copy during an active GT phase; null outside. */
export function getGTBannerText(date: Date = new Date()): string | null {
  const cur = getCurrentGTPhase(date);
  if (!cur) return null;
  return `🏁 ${GT_FULL_NAME[cur.id as GtPhaseId]} in progress — manage your squad →`;
}
