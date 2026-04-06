import {
  formatBudget,
  thresholdLabel,
  expandNationality,
  type SponsorRow,
} from "@/lib/sponsors";

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

function BonusLine({
  label,
  threshold,
  bonus,
  suffix,
}: {
  label: string;
  threshold: number;
  bonus: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        {thresholdLabel(threshold)} — {label}
      </span>
      <span className="font-mono text-[length:var(--type-body)] font-medium text-[var(--text-high)] tabular-nums">
        +{formatBudget(bonus)}
        {suffix && (
          <span className="ml-1 text-[var(--text-low)]">{suffix}</span>
        )}
      </span>
    </div>
  );
}

/**
 * Shared bonus details for a sponsor.
 * Renders BASE BONUS lines + MULTIPLIERS section.
 * Used in marketplace expanded row and budget card expanded state.
 *
 * BUG FIX: ×2 Monuments & Grand Tours is now shown for ALL T1-T4 sponsors
 * (previously only shown when bonus_monument > bonus_one_day, which was always
 * false for T1-T4 since they don't have explicit monument amounts).
 */
export function SponsorBonusDetails({ sponsor }: { sponsor: SponsorRow }) {
  const nationalities = expandNationality(sponsor.nationality);
  const nationalityFlags =
    nationalities.length > 0
      ? nationalities.map(countryFlag).join(" ")
      : null;

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
                <BonusLine label="Stage" threshold={sponsor.stage_threshold} bonus={sponsor.bonus_stage} suffix="(×2 GT)" />
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

      {/* MULTIPLIERS — shown for ALL T1-T4 (non-explicit prestige) */}
      {!sponsor.has_explicit_prestige && (
        <div className="border-t border-[var(--border-subtle)] pt-3">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-[var(--tracking-wide)] text-[var(--text-low)] block mb-2">
            Multipliers
          </span>
          <ul className="space-y-2 text-[length:var(--type-body)] text-[var(--text-mid)]">
            <li className="flex items-center gap-2">
              <span className="font-mono font-bold text-[var(--text-high)] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-app)] border border-[var(--border-default)] text-[length:var(--type-caption)]">
                ×2
              </span>
              <span>Monuments & Grand Tours</span>
            </li>
            {nationalityFlags && (
              <li className="flex items-center gap-2">
                <span className="font-mono font-bold text-[var(--text-high)] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-app)] border border-[var(--border-default)] text-[length:var(--type-caption)]">
                  ×1.25
                </span>
                <span>for riders {nationalityFlags}</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
