import {
  formatBudget,
  thresholdLabel,
  type SponsorRow,
} from "@/lib/sponsors";

function BonusLine({
  label,
  threshold,
  bonus,
}: {
  label: string;
  threshold: number;
  bonus: number;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[length:var(--type-body)] text-[var(--text-high)]">
        {thresholdLabel(threshold)} — {label}
      </span>
      <span className="font-mono text-[length:var(--type-body)] font-medium text-[var(--text-high)] tabular-nums">
        +{formatBudget(bonus)}
      </span>
    </div>
  );
}

/**
 * Shared bonus details for a sponsor.
 * Renders BASE BONUS lines only.
 * Used in marketplace expanded row and budget card expanded state.
 */
export function SponsorBonusDetails({ sponsor }: { sponsor: SponsorRow }) {
  return (
    <div className="mt-3 space-y-3">
      {/* BASE BONUS */}
      <div>
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-[var(--tracking-wide)] text-[var(--text-low)] block mb-2">
          Base Bonus
        </span>
        <div className="space-y-0.5">
          {sponsor.has_explicit_prestige ? (
            <>
              {sponsor.bonus_one_day > 0 && (
                <BonusLine label="One-Day" threshold={sponsor.one_day_threshold} bonus={sponsor.bonus_one_day} />
              )}
              {sponsor.bonus_monument != null && sponsor.bonus_monument > 0 && sponsor.monument_threshold != null && (
                <BonusLine label="Monument" threshold={sponsor.monument_threshold} bonus={sponsor.bonus_monument} />
              )}
              {sponsor.bonus_gc > 0 && (
                <BonusLine label="Stage Race GC" threshold={sponsor.gc_threshold} bonus={sponsor.bonus_gc} />
              )}
              {sponsor.bonus_grand_tour != null && sponsor.bonus_grand_tour > 0 && sponsor.grand_tour_threshold != null && (
                <BonusLine label="Grand Tour GC" threshold={sponsor.grand_tour_threshold} bonus={sponsor.bonus_grand_tour} />
              )}
              {sponsor.bonus_stage > 0 && (
                <BonusLine label="Stage" threshold={sponsor.stage_threshold} bonus={sponsor.bonus_stage} />
              )}
            </>
          ) : (
            <>
              {sponsor.bonus_gc > 0 && (
                <BonusLine label="GC" threshold={sponsor.gc_threshold} bonus={sponsor.bonus_gc} />
              )}
              {sponsor.bonus_one_day > 0 && (
                <BonusLine label="One-Day" threshold={sponsor.one_day_threshold} bonus={sponsor.bonus_one_day} />
              )}
              {sponsor.bonus_stage > 0 && (
                <BonusLine label="Stage" threshold={sponsor.stage_threshold} bonus={sponsor.bonus_stage} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
