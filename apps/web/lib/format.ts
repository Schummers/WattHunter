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
