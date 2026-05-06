import { formatBudget } from "@/lib/sponsors";
import { Tag } from "@/components/pill";
import type { GtGoal, GtGoalCategory } from "@/lib/gt-goals";

const ROLE_LABELS: Record<string, string> = {
  gc_leader: "GC Leader",
  sprinter: "Sprinter",
  climber: "Climber",
  tt_specialist: "TT Specialist",
  stage_hunter: "Stage Hunter",
};

const CATEGORY_LABELS: Record<GtGoalCategory, string> = {
  gc: "GC",
  sprint: "Sprint",
  tt: "TT",
  stage_hunter: "Stage Hunter",
};

function groupByCategory(goals: GtGoal[]): [GtGoalCategory, GtGoal[]][] {
  const groups = new Map<GtGoalCategory, GtGoal[]>();
  for (const g of goals) {
    const list = groups.get(g.category);
    if (list) {
      list.push(g);
    } else {
      groups.set(g.category, [g]);
    }
  }
  for (const list of groups.values()) {
    list.sort((a, b) => b.reward - a.reward);
  }
  return [...groups.entries()];
}

export function GtGoalsPreview({ goals }: { goals: GtGoal[] }) {
  if (!goals.length) return null;
  const groups = groupByCategory(goals);
  return (
    <div className="mt-3 border-t border-[var(--border-default)] pt-3">
      {groups.map(([category, categoryGoals], groupIdx) => (
        <div key={category}>
          {groupIdx > 0 && (
            <div className="border-t border-[var(--border-default)] my-2.5" />
          )}
          <div className="flex items-center gap-1.5 mb-2">
            <Tag variant="highlighted">{CATEGORY_LABELS[category]}</Tag>
            <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
              Bonus (one-time)
            </span>
          </div>
          <ul className="flex flex-col">
            {categoryGoals.map((g, i) => (
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
      ))}
    </div>
  );
}
