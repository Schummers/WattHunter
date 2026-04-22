import { Tag } from "@/components/pill";
import { formatBudget } from "@/lib/sponsors";
import type { GtGoal } from "@/lib/gt-goals";

export function GtGoalsPreview({ goals }: { goals: GtGoal[] }) {
  if (!goals.length) return null;
  return (
    <div className="mt-3 border-t border-[var(--border-default)] pt-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          GT Goals
        </span>
        <Tag variant="default">Preview (V1b)</Tag>
      </div>
      <ul className="flex flex-col gap-1">
        {goals.map((g) => (
          <li key={g.label} className="flex items-baseline justify-between py-1">
            <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
              {g.label}
            </span>
            <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] text-[var(--text-low)] tabular-nums">
              +{formatBudget(g.reward)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
