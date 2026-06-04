import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Tag } from "@/components/pill";
import { cn } from "@/lib/utils";
import {
  formatBudget,
  getOrientationTags,
  type SponsorRow,
} from "@/lib/sponsors";
import { countryCodeToFlag } from "@/lib/format";
import { GtGoalsPreview } from "@/components/gt-goals-preview";
import { getGoalsForSponsor } from "@/lib/gt-goals";

// Maps ISO country codes to demonym adjectives for the nationality note
const NATIONALITY_DEMONYMS: Record<string, string> = {
  FR: "French",
  ES: "Spanish",
  BE: "Belgian",
  NL: "Dutch",
  GB: "British",
  US: "American",
  IT: "Italian",
  DK: "Danish",
  NO: "Norwegian",
};

/** Column grid shared by the block header and every value row: label | A | B. */
const ROW_GRID = "grid grid-cols-[1fr_3.25rem_3.25rem] items-baseline";

/**
 * Literal threshold label for the sponsor card: "Top 10" / "Win".
 * Deliberately NOT `thresholdLabel()` — the threshold varies by level so we never
 * bake in "Podium"/"Victory" here (e.g. "Stage — Top 3", not "Podium Stage").
 */
function topLabel(threshold: number): string {
  return threshold <= 1 ? "Win" : `Top ${threshold}`;
}

/** Block title row with the A/B column headers aligned to the value columns. */
function BlockHead({ title }: { title: ReactNode }) {
  return (
    <div className={cn(ROW_GRID, "mt-1 pt-2 border-t border-[var(--border-default)]")}>
      <span className="flex items-center gap-1.5 text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
        {title}
      </span>
      <span className="text-right text-[length:var(--type-micro)] font-bold uppercase tracking-wide text-[var(--text-low)]">
        A
      </span>
      <span className="text-right text-[length:var(--type-micro)] font-bold uppercase tracking-wide text-[var(--text-low)] pl-2">
        B
      </span>
    </div>
  );
}

/** Two-value bonus row: A = 1-week / one-day (secondary), B = GT / Monument (high). */
function BonusRow({ label, a, b }: { label: ReactNode; a: number; b: number }) {
  return (
    <div className={cn(ROW_GRID, "py-1")}>
      <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">{label}</span>
      <span className="text-right font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] font-semibold text-[var(--text-mid)] tabular-nums">
        +{formatBudget(a)}
      </span>
      <span className="text-right font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] font-semibold text-[var(--text-high)] tabular-nums pl-2 border-l border-[var(--border-subtle)]">
        +{formatBudget(b)}
      </span>
    </div>
  );
}

/** Base bonus (Tiers 1-4): B = ×2 (GT / Monument). */
function BaseBonusContent({ sponsor }: { sponsor: SponsorRow }) {
  return (
    <div>
      <BlockHead title="Base Bonus (cumulative)" />
      {sponsor.bonus_gc > 0 && (
        <BonusRow label={`GC — ${topLabel(sponsor.gc_threshold)}`} a={sponsor.bonus_gc} b={sponsor.bonus_gc * 2} />
      )}
      {sponsor.bonus_stage > 0 && (
        <BonusRow label={`Stage — ${topLabel(sponsor.stage_threshold)}`} a={sponsor.bonus_stage} b={sponsor.bonus_stage * 2} />
      )}
      {sponsor.bonus_one_day > 0 && (
        <BonusRow label={`One-day — ${topLabel(sponsor.one_day_threshold)}`} a={sponsor.bonus_one_day} b={sponsor.bonus_one_day * 2} />
      )}
    </div>
  );
}

/**
 * Prestige bonus (Tiers 5-6): B uses the explicit Grand Tour / Monument value
 * when present, else falls back to ×2 (same rule as the base tiers).
 */
function PrestigeBonusContent({ sponsor }: { sponsor: SponsorRow }) {
  const gtGc =
    sponsor.bonus_grand_tour != null && sponsor.bonus_grand_tour > 0
      ? sponsor.bonus_grand_tour
      : sponsor.bonus_gc * 2;
  const gtOneDay =
    sponsor.bonus_monument != null && sponsor.bonus_monument > 0
      ? sponsor.bonus_monument
      : sponsor.bonus_one_day * 2;
  return (
    <div>
      <BlockHead title="Base Bonus (cumulative)" />
      {sponsor.bonus_gc > 0 && (
        <BonusRow label={`GC — ${topLabel(sponsor.gc_threshold)}`} a={sponsor.bonus_gc} b={gtGc} />
      )}
      {sponsor.bonus_stage > 0 && (
        <BonusRow label={`Stage — ${topLabel(sponsor.stage_threshold)}`} a={sponsor.bonus_stage} b={sponsor.bonus_stage * 2} />
      )}
      {sponsor.bonus_one_day > 0 && (
        <BonusRow label={`One-day — ${topLabel(sponsor.one_day_threshold)}`} a={sponsor.bonus_one_day} b={gtOneDay} />
      )}
    </div>
  );
}

/**
 * Shared footer for the sponsor card: nationality note (×1.20) followed by the
 * A/B column legend. Order: nationality → A → B.
 */
export function SponsorBonusLegend({ sponsor }: { sponsor: SponsorRow }) {
  const nationalities = sponsor.nationality
    ? sponsor.nationality.split("/").map((c) => c.trim())
    : [];
  return (
    <div className="mt-2.5 pt-2.5 border-t border-[var(--border-default)] flex flex-col gap-1 text-[length:var(--type-caption)] text-[var(--text-low)]">
      {nationalities.length > 0 && (
        <div className="flex items-center gap-1.5">
          {nationalities.map((nat) => (
            <span key={nat}>{countryCodeToFlag(nat)}</span>
          ))}
          <span>
            {nationalities.map((nat) => NATIONALITY_DEMONYMS[nat] ?? nat).join(" / ")}{" "}
            rider: all bonuses ×1.20
          </span>
        </div>
      )}
      <div>
        <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-mid)]">A</span>{" "}
        1-week race &amp; one-day
      </div>
      <div>
        <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-mid)]">B</span>{" "}
        Grand Tour &amp; Monument (×2)
      </div>
    </div>
  );
}

/**
 * Standalone sponsor card with expand/collapse — used in Budget page.
 * Same visual layout as the marketplace SponsorCard, without the radio button.
 */
export function SponsorBonusCard({
  sponsor,
  expanded,
  onToggle,
  completedGoalIndices,
}: {
  sponsor: SponsorRow;
  expanded: boolean;
  onToggle: () => void;
  completedGoalIndices?: number[];
}) {
  const nationalities = sponsor.nationality
    ? sponsor.nationality.split("/").map((c) => c.trim())
    : [];
  const goals = getGoalsForSponsor(sponsor.slug);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] transition-colors">
      {/* Header row — click to expand */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-1 px-3.5 py-3 text-left hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-lg)] transition-colors"
      >
        {/* Line 1: Name + Budget */}
        <div className="flex w-full items-center gap-2.5">
          <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
            {sponsor.name}
          </span>
          <span className="ml-auto font-[family-name:var(--font-geist-mono)] text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)] tabular-nums">
            {formatBudget(sponsor.monthly_budget)}
          </span>
          <ChevronDown
            size={16}
            className={cn(
              "shrink-0 text-[var(--text-low)] transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </div>
        {/* Line 2: Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {getOrientationTags(sponsor).map((tag) => (
            <Tag key={tag} variant="highlighted">{tag}</Tag>
          ))}
          {nationalities.length > 0 && (
            <Tag variant="highlighted">
              {nationalities.map((nat) => countryCodeToFlag(nat)).join(" ")}
            </Tag>
          )}
        </div>
      </button>

      {/* Expanded bonus content */}
      {expanded && (
        <div className="px-3.5 pb-3.5">
          {sponsor.has_explicit_prestige ? (
            <PrestigeBonusContent sponsor={sponsor} />
          ) : (
            <BaseBonusContent sponsor={sponsor} />
          )}
          <GtGoalsPreview goals={goals} completedGoalIndices={completedGoalIndices} />
          <SponsorBonusLegend sponsor={sponsor} />
        </div>
      )}
    </div>
  );
}

export { BaseBonusContent, PrestigeBonusContent };
