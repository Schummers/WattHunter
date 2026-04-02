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
    return m === Math.floor(m) ? `${m}M` : `${m}M`;
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
