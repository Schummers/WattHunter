"use client";

import { LEVELS } from "@/lib/levels";

export interface LevelSelectorProps {
  selected: number;
  recommended: number;
  isCommissioner: boolean;
  onSelect: (level: number) => void;
}

export function LevelSelector({
  selected,
  recommended,
  isCommissioner,
  onSelect,
}: LevelSelectorProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
        Starting level
      </h2>
      <div
        role="radiogroup"
        aria-label="Starting level"
        className="flex flex-wrap gap-2"
      >
        {LEVELS.map((lvl) => {
          const isSelected = lvl.level === selected;
          const isRecommended = lvl.level === recommended;
          return (
            <button
              key={lvl.level}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Level ${lvl.level}${isRecommended ? " (recommended)" : ""}`}
              disabled={!isCommissioner}
              onClick={() => isCommissioner && onSelect(lvl.level)}
              className={[
                "relative inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] border px-3 font-mono text-[length:var(--type-body)] font-semibold transition-colors",
                isSelected
                  ? "border-[var(--accent-default)] bg-[var(--badge-bg)] text-[var(--accent-label)]"
                  : "border-[var(--border-default)] text-[var(--text-mid)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-high)]",
                !isCommissioner && !isSelected ? "opacity-60" : "",
                "disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {lvl.level}
              {isRecommended ? (
                <span className="ml-2 rounded-[var(--radius-pill)] bg-[var(--badge-bg)] px-1.5 py-px text-[length:var(--type-micro)] font-bold uppercase text-[var(--accent-label)]">
                  Rec
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {!isCommissioner ? (
        <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          Only the Race Director can change the starting level.
        </p>
      ) : null}
    </section>
  );
}
