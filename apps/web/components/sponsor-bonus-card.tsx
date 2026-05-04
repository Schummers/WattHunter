import { ChevronDown } from "lucide-react";
import { Tag } from "@/components/pill";
import { cn } from "@/lib/utils";
import {
  formatBudget,
  thresholdLabel,
  ORIENTATION_LABELS,
  getOrientationTags,
  type SponsorRow,
} from "@/lib/sponsors";
import { countryCodeToFlag } from "@/lib/format";

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

/** Inline bonus content for Tiers 1-4 (two-column base/enhanced layout) */
function BaseBonusContent({ sponsor }: { sponsor: SponsorRow }) {
  const nationalities = sponsor.nationality
    ? sponsor.nationality.split("/").map((c) => c.trim())
    : [];

  const isGcFirst = sponsor.orientation !== "one_day";

  const gcStageGroup = (
    <>
      {sponsor.bonus_gc > 0 && (
        <div className="flex items-baseline py-1 gap-2">
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {thresholdLabel(sponsor.gc_threshold)} GC
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] text-[var(--text-low)] tabular-nums">
            +{formatBudget(sponsor.bonus_gc)}
          </span>
          <span className="ml-auto flex items-baseline gap-1">
            <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">if Grand Tour</span>
            <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] font-semibold text-[var(--text-high)] tabular-nums">
              +{formatBudget(sponsor.bonus_gc * 2)}
            </span>
          </span>
        </div>
      )}
      {sponsor.bonus_stage > 0 && (
        <div className="flex items-baseline py-1 gap-2">
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {thresholdLabel(sponsor.stage_threshold)} Stage
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] text-[var(--text-low)] tabular-nums">
            +{formatBudget(sponsor.bonus_stage)}
          </span>
          <span className="ml-auto flex items-baseline gap-1">
            <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">if Grand Tour</span>
            <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] font-semibold text-[var(--text-high)] tabular-nums">
              +{formatBudget(sponsor.bonus_stage * 2)}
            </span>
          </span>
        </div>
      )}
    </>
  );

  const oneDayGroup = (
    <>
      {sponsor.bonus_one_day > 0 && (
        <div className="flex items-baseline py-1 gap-2">
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {thresholdLabel(sponsor.one_day_threshold)} One-Day
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] text-[var(--text-low)] tabular-nums">
            +{formatBudget(sponsor.bonus_one_day)}
          </span>
          <span className="ml-auto flex items-baseline gap-1">
            <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">if Monument</span>
            <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] font-semibold text-[var(--text-high)] tabular-nums">
              +{formatBudget(sponsor.bonus_one_day * 2)}
            </span>
          </span>
        </div>
      )}
    </>
  );

  return (
    <div>
      <div className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] mt-1 pt-2 border-t border-[var(--border-default)]">
        Base Bonus
      </div>
      {isGcFirst ? (
        <>
          {gcStageGroup}
          <div className="border-t border-[var(--border-subtle)] my-1.5" />
          {oneDayGroup}
        </>
      ) : (
        <>
          {oneDayGroup}
          <div className="border-t border-[var(--border-subtle)] my-1.5" />
          {gcStageGroup}
        </>
      )}
      {nationalities.length > 0 && (
        <div className="flex items-center gap-1.5 border-t border-[var(--border-default)] mt-2.5 pt-2.5 text-[length:var(--type-caption)] text-[var(--text-low)]">
          {nationalities.map((nat) => (
            <span key={nat}>{countryCodeToFlag(nat)}</span>
          ))}
          <span>
            {nationalities
              .map((nat) => NATIONALITY_DEMONYMS[nat] ?? nat)
              .join(" / ")}{" "}
            rider: all bonuses ×1.25
          </span>
        </div>
      )}
    </div>
  );
}

/** Inline bonus content for Tiers 5-6 (prestige single-column layout) */
function PrestigeBonusContent({ sponsor }: { sponsor: SponsorRow }) {
  const hasGrandTourGC =
    sponsor.bonus_grand_tour != null &&
    sponsor.bonus_grand_tour > 0 &&
    sponsor.grand_tour_threshold != null;
  const hasMonument =
    sponsor.bonus_monument != null &&
    sponsor.bonus_monument > 0 &&
    sponsor.monument_threshold != null;

  return (
    <div>
      <div className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] mt-1 pt-2 border-t border-[var(--border-default)]">
        Prestige Bonus
      </div>
      {hasGrandTourGC && (
        <div className="flex items-baseline justify-between py-1">
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {thresholdLabel(sponsor.grand_tour_threshold!)} Grand Tour GC
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] font-semibold text-[var(--text-high)] tabular-nums">
            +{formatBudget(sponsor.bonus_grand_tour!)}
          </span>
        </div>
      )}
      {sponsor.bonus_gc > 0 && (
        <div className="flex items-baseline justify-between py-1">
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {thresholdLabel(sponsor.gc_threshold)} Stage Race GC
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] font-semibold text-[var(--text-high)] tabular-nums">
            +{formatBudget(sponsor.bonus_gc)}
          </span>
        </div>
      )}
      {sponsor.bonus_stage > 0 && (
        <div className="flex items-baseline justify-between py-1">
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {thresholdLabel(sponsor.stage_threshold)} Stage
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] font-semibold text-[var(--text-high)] tabular-nums">
            +{formatBudget(sponsor.bonus_stage)}
          </span>
        </div>
      )}
      {(hasGrandTourGC || sponsor.bonus_gc > 0 || sponsor.bonus_stage > 0) &&
        (hasMonument || sponsor.bonus_one_day > 0) && (
          <div className="border-t border-[var(--border-subtle)] my-1.5" />
        )}
      {hasMonument && (
        <div className="flex items-baseline justify-between py-1">
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {thresholdLabel(sponsor.monument_threshold!)} Monument
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] font-semibold text-[var(--text-high)] tabular-nums">
            +{formatBudget(sponsor.bonus_monument!)}
          </span>
        </div>
      )}
      {sponsor.bonus_one_day > 0 && (
        <div className="flex items-baseline justify-between py-1">
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {thresholdLabel(sponsor.one_day_threshold)} One-Day
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] font-semibold text-[var(--text-high)] tabular-nums">
            +{formatBudget(sponsor.bonus_one_day)}
          </span>
        </div>
      )}
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
  gtGoalsPreview,
}: {
  sponsor: SponsorRow;
  expanded: boolean;
  onToggle: () => void;
  gtGoalsPreview?: React.ReactNode;
}) {
  const nationalities = sponsor.nationality
    ? sponsor.nationality.split("/").map((c) => c.trim())
    : [];

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
          {gtGoalsPreview}
        </div>
      )}
    </div>
  );
}

export { BaseBonusContent, PrestigeBonusContent, NATIONALITY_DEMONYMS };
