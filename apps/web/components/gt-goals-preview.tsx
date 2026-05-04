import { formatBudget } from "@/lib/sponsors";
import type { GtGoal } from "@/lib/gt-goals";

const ROLE_LABELS: Record<string, string> = {
  gc_leader: "GC Leader",
  sprinter: "Sprinter",
  climber: "Climber",
  tt_specialist: "TT Specialist",
  stage_hunter: "Stage Hunter",
};

export function GtGoalsPreview({ goals }: { goals: GtGoal[] }) {
  if (!goals.length) return null;
  return (
    <div className="mt-3 border-t border-[var(--border-default)] pt-3">
      <div className="mb-2">
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          Sponsor Bonus (unique)
        </span>
      </div>
      <ul className="flex flex-col">
        {goals.map((g, i) => (
          <li key={`${g.label}-${i}`} className="flex items-baseline justify-between py-1">
            <span className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
                {g.label}
              </span>
              <span className="text-[length:var(--type-caption)] text-[var(--text-mid)] shrink-0">
                {g.role ? ROLE_LABELS[g.role] ?? g.role : "All"}
              </span>
            </span>
            <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] font-semibold text-[var(--text-high)] tabular-nums shrink-0 ml-2">
              +{formatBudget(g.reward)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
