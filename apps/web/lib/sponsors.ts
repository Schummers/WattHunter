/**
 * Sponsor types and helpers — v2 (simplified model).
 *
 * 1 sponsor per team, level-gated only, no eligibility conditions.
 * Design spec: docs/superpowers/specs/2026-04-02-sponsors-rework-design.md
 */

export interface SponsorRow {
  id: string;
  name: string;
  slug: string;
  tier: number;
  unlock_level: number;
  monthly_budget: number;
  orientation: "gc" | "one_day" | "neutral";
  nationality: string | null;
  bonus_gc: number;
  bonus_one_day: number;
  bonus_stage: number;
  gc_threshold: number;
  one_day_threshold: number;
  stage_threshold: number;
  has_explicit_prestige: boolean;
  bonus_monument: number | null;
  bonus_grand_tour: number | null;
  monument_threshold: number | null;
  grand_tour_threshold: number | null;
  sort_order: number;
}

export interface TeamSponsor {
  id: string;
  team_id: string;
  sponsor_id: string;
  activated_at: string;
  sponsors?: SponsorRow;
}

/**
 * Expand compound nationality codes for display.
 * 'BE/NL' → ['BE', 'NL'], 'FR' → ['FR'], null → []
 */
export function expandNationality(code: string | null): string[] {
  if (!code) return [];
  return code.split("/").map((c) => c.trim());
}

/**
 * Format sponsor tier label for display.
 */
export function tierLabel(tier: number): string {
  return `Tier ${tier}`;
}

/**
 * Format monthly budget as compact string: "250K", "1M", "1.25M"
 */
export function formatBudget(monthly: number): string {
  if (monthly >= 1_000_000) {
    const m = monthly / 1_000_000;
    return `${m % 1 === 0 ? m : m.toFixed(2).replace(/\.?0+$/, "")}M`;
  }
  return `${Math.round(monthly / 1000)}K`;
}

/**
 * Threshold label for display: 1 → "Victory", 3 → "Podium", N → "Top N"
 */
export function thresholdLabel(threshold: number): string {
  if (threshold === 1) return "Victory";
  if (threshold === 3) return "Podium";
  return `Top ${threshold}`;
}

/**
 * Group sponsors by tier for marketplace display.
 * Returns array of { tier, unlockLevel, sponsors[] } sorted by tier.
 */
export function groupByTier(sponsors: SponsorRow[]): {
  tier: number;
  unlockLevel: number;
  sponsors: SponsorRow[];
}[] {
  const map = new Map<number, { tier: number; unlockLevel: number; sponsors: SponsorRow[] }>();

  for (const s of sponsors) {
    if (!map.has(s.tier)) {
      map.set(s.tier, { tier: s.tier, unlockLevel: s.unlock_level, sponsors: [] });
    }
    map.get(s.tier)!.sponsors.push(s);
  }

  return Array.from(map.values())
    .sort((a, b) => a.tier - b.tier)
    .map((g) => ({
      ...g,
      sponsors: g.sponsors.sort((a, b) => a.sort_order - b.sort_order),
    }));
}

/**
 * Shared filter function for treasury_log transactions.
 * Used by both budget-client and transactions-client.
 */
export const TRANSACTION_FILTER_OPTIONS = [
  { label: "All" },
  { label: "Bonuses" },
  { label: "Salaries" },
  { label: "Sponsors" },
];

export const ORIENTATION_LABELS: Record<string, string> = {
  gc: "GC",
  one_day: "One-Day",
  neutral: "neutral",
};

/**
 * Display-oriented tags per sponsor slug.
 * T4+ sponsors can have multiple orientation tags.
 * Falls back to ORIENTATION_LABELS[orientation] for sponsors not in this map.
 */
export const SPONSOR_ORIENTATION_TAGS: Record<string, string[]> = {
  ineos: ["GC", "TT"],
  decathlon: ["GC", "Sprint"],
  soudal: ["Sprint", "Stage Hunter"],
  "lidl-trek": ["Sprint", "Stage Hunter"],
};

/**
 * Get display tags for a sponsor. Returns array of tag strings.
 * Uses slug-specific override if available, else falls back to orientation label.
 */
export function getOrientationTags(sponsor: SponsorRow): string[] {
  if (SPONSOR_ORIENTATION_TAGS[sponsor.slug]) {
    return SPONSOR_ORIENTATION_TAGS[sponsor.slug];
  }
  const label = ORIENTATION_LABELS[sponsor.orientation];
  return label && label !== "neutral" ? [label] : [];
}

export function filterTransactions<T extends { type: string }>(
  transactions: T[],
  filterIndex: number,
): T[] {
  if (filterIndex === 0) return transactions;
  if (filterIndex === 1)
    return transactions.filter((t) =>
      ["sponsor_bonus", "transfer_bonus"].includes(t.type),
    );
  if (filterIndex === 2)
    return transactions.filter((t) =>
      ["payday_salary", "auction_purchase", "release_fee", "bankruptcy_release"].includes(t.type),
    );
  if (filterIndex === 3)
    return transactions.filter((t) =>
      ["sponsor_payment"].includes(t.type),
    );
  return transactions;
}
