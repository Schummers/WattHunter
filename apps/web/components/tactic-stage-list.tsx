"use client";
import { Tag } from "@/components/pill";
import { cn } from "@/lib/utils";
import type { GtStage } from "@/lib/gt-stages";

export function StageList({
  stages,
  value,
  onChange,
  fillParent,
}: {
  stages: GtStage[];
  value: string;
  onChange: (v: string) => void;
  fillParent?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-app)]",
        fillParent ? "min-h-0 flex-1" : "max-h-[224px]"
      )}
    >
      <div className="flex flex-col">
        {stages.map((s, i) => {
          const isSelected = value === s.slug;
          const isLocked = !!s.hasTacticActive;
          const isToday = s.status === "today";
          const isFirst = i === 0;
          return (
            <button
              key={s.slug}
              type="button"
              onClick={() => !isLocked && onChange(s.slug)}
              disabled={isLocked}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
                !isFirst && "border-t border-[var(--border-subtle)]",
                isSelected && !isLocked && "bg-[var(--badge-bg)]",
                !isSelected && !isLocked && "hover:bg-[var(--bg-surface-hover)]",
                isLocked && "cursor-not-allowed opacity-50"
              )}
            >
              <div
                role="radio"
                aria-checked={isSelected}
                className={cn(
                  "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  isSelected
                    ? "border-[var(--accent-default)] bg-[var(--accent-default)]"
                    : "border-[var(--border-default)] bg-transparent"
                )}
              >
                {isSelected && (
                  <div className="size-[7px] rounded-full bg-[var(--bg-app)]" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="font-mono text-[length:var(--type-emphasis)] font-bold tabular-nums text-[var(--text-high)]">
                  Stage {s.number}
                </span>
                <span className="font-mono text-[length:var(--type-caption)] tabular-nums text-[var(--text-low)]">
                  {s.date}
                </span>
              </div>
              {isToday && !isLocked && (
                <Tag variant="highlighted" className="text-[length:var(--type-micro)]">
                  Today
                </Tag>
              )}
              {isLocked && (
                <span className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]">
                  Tactic set
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
