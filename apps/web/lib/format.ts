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

/** Format number with space thousands separator + € symbol. e.g. "155 000 €" */
export function formatEuro(amount: number): string {
  return amount.toLocaleString("fr-FR") + " €";
}

/** Format number with space thousands separator only. e.g. "155 000" */
export function formatThousands(amount: number): string {
  return amount.toLocaleString("fr-FR");
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
export const SALARY_COEFFICIENT = 2000;
export const SALARY_FLOOR = 5000;

/** Calculate minimum monthly salary for a rider based on PCS points (floored to nearest 100). */
export function calcMinSalary(pcsPoints: number): number {
  const raw = (pcsPoints * SALARY_COEFFICIENT) / 12;
  return Math.max(SALARY_FLOOR, Math.floor(raw / 100) * 100);
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

