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
 * Sub-tab label for the Team layout.
 *
 * Preferred call: `getGTSubTabLabel(date, { override })` — pass the
 * server-resolved label from `resolveRaceTeamLabel` (e.g. "Paris-Nice Team")
 * so 1-week races render correctly. The override always wins when provided.
 *
 * Legacy call (no override): keeps prior GT-only semantics —
 *   - During a GT phase → `Giro Team` / `Tour Team` / `Vuelta Team`
 *   - Outside           → `Race Team` (renamed from `GT Team` per Spec A A9)
 */
export function getGTSubTabLabel(
  date: Date = new Date(),
  opts?: { override?: string | null },
): string {
  if (opts?.override) return opts.override;
  const cur = getCurrentGTPhase(date);
  if (!cur) return "Race Team";
  return `${GT_SHORT_NAME[cur.id as GtPhaseId]} Team`;
}

/** Home banner copy during an active GT phase; null outside. */
export function getGTBannerText(date: Date = new Date()): string | null {
  const cur = getCurrentGTPhase(date);
  if (!cur) return null;
  return `🏁 ${GT_FULL_NAME[cur.id as GtPhaseId]} in progress — manage your squad →`;
}

/** Canonical GT identifier per phase. */
export const GT_IDENTIFIER: Record<
  GtPhaseId,
  "giro-d-italia" | "tour-de-france" | "vuelta-a-espana"
> = {
  4: "giro-d-italia",
  6: "tour-de-france",
  8: "vuelta-a-espana",
};

/**
 * Approximate current GT stage number (1-indexed) based on days elapsed since
 * the GT's start date. Returns null if we are not currently inside a GT phase.
 *
 * NOTE: This is an approximation — actual races have 2 rest days so the
 * estimate may drift by up to 2. Acceptable for MVP banner display.
 */
export function getCurrentGTStage(date: Date = new Date()): number | null {
  const effective = resolveDate(date);
  const phase = getCurrentGTPhase(effective);
  if (!phase) return null;
  const year = effective.getFullYear();
  const start = new Date(year, phase.startMonth - 1, phase.startDay);
  const daysElapsed = Math.floor(
    (effective.getTime() - start.getTime()) / 86_400_000,
  );
  return Math.max(1, Math.min(21, daysElapsed + 1));
}
