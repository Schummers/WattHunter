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

/** Smart countdown: "in X days" or "in X hours" depending on remaining time. */
export function smartCountdown(target: Date | string): string {
  const end = typeof target === "string" ? new Date(target) : target;
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return "ended";
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "in < 1 hour";
  if (diffHours < 24) return `in ${diffHours} hour${diffHours > 1 ? "s" : ""}`;
  const diffDays = Math.floor(diffHours / 24);
  return `in ${diffDays} day${diffDays > 1 ? "s" : ""}`;
}

/** Release fee constant — flat 5 000 EUR per release */
export const RELEASE_FEE = 5_000;

/**
 * Calculate transfer bonus when releasing a rider.
 * Bonus = max(0, current_min_salary - locked_salary)
 */
export function calcTransferBonus(pcsPoints: number, lockedSalary: number): number {
  const currentMinSalary = calcMinSalary(pcsPoints);
  return Math.max(0, currentMinSalary - lockedSalary);
}
