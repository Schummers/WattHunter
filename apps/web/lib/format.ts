/**
 * Formatting utilities for WattHunter UI.
 */

/** Convert ISO 3166-1 alpha-2 country code to flag emoji. */
export function countryCodeToFlag(code: string): string {
  const upper = code.toUpperCase();
  if (upper.length !== 2) return code;
  const offset = 0x1f1e6 - 65; // 'A' = 65
  return String.fromCodePoint(
    upper.charCodeAt(0) + offset,
    upper.charCodeAt(1) + offset
  );
}

/** Format number with space thousands separator only. e.g. "155 000" */
export function formatThousands(amount: number): string {
  return amount.toLocaleString("fr-FR");
}

/**
 * Unified compact money format with € prefix. Sign-free — callers prepend +/− as needed.
 * Granularity is the thousand (bids/salaries are multiples of 1000), so "k" reads cleanly.
 *   52000 → "€52k" · 369000 → "€369k" · 1_250_000 → "€1.25M" · 5000 → "€5k" · 500 → "€500"
 */
export function formatMoney(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const str = (abs / 1_000_000).toFixed(2).replace(/\.?0+$/, "");
    return `€${str}M`;
  }
  if (abs >= 1_000) return `€${Math.round(abs / 1000)}k`;
  return `€${abs}`;
}

/** Format XP: max 1 decimal, trailing zeros stripped. e.g. 63.7099 → "63.7", 83.0 → "83".
 *  Guards against IEEE-754 accumulation artefacts from summing fractional xp_gained. */
export function formatXp(xp: number): string {
  const rounded = Math.round(xp * 10) / 10;
  return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
}

/** Format date as "Sat, Mar 8" — consistent across all browsers/locales. */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Salary coefficient: pts_PCS × SALARY_COEFFICIENT / 12, floor at SALARY_FLOOR. */
export const SALARY_COEFFICIENT = 2500;
export const SALARY_FLOOR = 5000;

/** Calculate minimum monthly salary for a rider based on PCS points (floored to nearest 1000). */
export function calcMinSalary(pcsPoints: number): number {
  const raw = (pcsPoints * SALARY_COEFFICIENT) / 12;
  return Math.max(SALARY_FLOOR, Math.floor(raw / 1000) * 1000);
}

/** Unified round countdown. Returns display text and urgency flag for color styling.
 *  text: "closes in 1d 5h" | "opens in 18h" | "closes in < 1h" | "ended"
 *  urgent: true when ≤ 48h remain (use --warning color token)
 */
export function formatRoundCountdown(
  target: Date | string,
  status: "open" | "scheduled"
): { text: string; urgent: boolean } {
  const end = typeof target === "string" ? new Date(target) : target;
  const diffMs = end.getTime() - Date.now();

  if (diffMs <= 0) return { text: "ended", urgent: false };

  const prefix = status === "open" ? "closes in" : "opens in";
  const urgent = diffMs <= 48 * 60 * 60 * 1000;

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (totalHours < 1) return { text: `${prefix} < 1h`, urgent };
  if (days > 0) return { text: `${prefix} ${days}d ${hours}h`, urgent };
  return { text: `${prefix} ${totalHours}h`, urgent };
}

