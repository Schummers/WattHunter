import { formatBudget } from "@/lib/sponsors";
import { Tag } from "@/components/pill";
import { Check } from "lucide-react";
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

interface IndexedGoal extends GtGoal {
  originalIndex: number;
}

function groupByCategory(goals: GtGoal[]): [GtGoalCategory, IndexedGoal[]][] {
  const groups = new Map<GtGoalCategory, IndexedGoal[]>();
  for (let i = 0; i < goals.length; i++) {
    const g = goals[i];
    const indexed = { ...g, originalIndex: i };
    const list = groups.get(g.category);
    if (list) {
      list.push(indexed);
    } else {
      groups.set(g.category, [indexed]);
    }
  }
  for (const list of groups.values()) {
    list.sort((a, b) => b.reward - a.reward);
  }
  return [...groups.entries()];
}

interface GtGoalsPreviewProps {
  goals: GtGoal[];
  completedGoalIndices?: number[];
}

export function GtGoalsPreview({ goals, completedGoalIndices = [] }: GtGoalsPreviewProps) {
  if (!goals.length) return null;
  const groups = groupByCategory(goals);
  const completedSet = new Set(completedGoalIndices);
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
            {categoryGoals.map((g) => {
              const isCompleted = completedSet.has(g.originalIndex);
              return (
                <li
                  key={`${g.label}-${g.originalIndex}`}
                  className={`flex items-baseline justify-between py-1 ${isCompleted ? "opacity-50" : ""}`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    {isCompleted && (
                      <Check className="size-3.5 text-[var(--accent-default)] shrink-0 relative top-px" />
                    )}
                    <span className={`text-[length:var(--type-caption)] text-[var(--text-high)] ${isCompleted ? "line-through" : ""}`}>
                      {g.label}
                    </span>
                    <span className="text-[length:var(--type-caption)] text-[var(--text-mid)] shrink-0">
                      {g.role ? ROLE_LABELS[g.role] ?? g.role : "All"}
                    </span>
                  </span>
                  <span className={`font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] font-semibold tabular-nums shrink-0 ml-2 ${isCompleted ? "text-[var(--accent-default)]" : "text-[var(--text-high)]"}`}>
                    +{formatBudget(g.reward)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
