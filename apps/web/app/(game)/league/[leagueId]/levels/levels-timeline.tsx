"use client";

import { useState } from "react";
import { CircleCheck, Lock, ChevronDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { LEVELS, getUnlockDescriptions } from "@/lib/levels";

interface LevelsTimelineProps {
  currentLevel: number;
  currentXp: number;
  progressPct: number;
  nextLevelXp: number;
}

function renderBoldText(text: string, state: "current" | "locked" | "completed") {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      return (
        <strong
          key={i}
          className={
            state === "current"
              ? "text-[var(--text-high)]"
              : state === "completed"
              ? "text-[var(--text-mid)]"
              : "text-[var(--text-mid)]"
          }
        >
          {inner}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function LevelsTimeline({
  currentLevel,
  currentXp,
  progressPct,
  nextLevelXp,
}: LevelsTimelineProps) {
  // Completed = collapsed by default, current + locked = expanded
  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    for (const lvl of LEVELS) {
      initial[lvl.level] = lvl.level >= currentLevel;
    }
    return initial;
  });

  function toggleLevel(level: number) {
    setExpanded((prev) => ({ ...prev, [level]: !prev[level] }));
  }

  return (
    <div className="space-y-0">
      {LEVELS.map((lvl) => {
        const isCompleted = lvl.level < currentLevel;
        const isCurrent = lvl.level === currentLevel;
        const isLocked = lvl.level > currentLevel;
        const isOpen = expanded[lvl.level] ?? false;
        const descriptions = getUnlockDescriptions(lvl.level);

        const state = isCompleted ? "completed" : isCurrent ? "current" : "locked";

        const rowOpacity = isCompleted ? "opacity-60" : isLocked ? "opacity-70" : "";

        return (
          <div key={lvl.level} className={rowOpacity}>
            {/* Header row — always visible, toggles expand */}
            <button
              onClick={() => toggleLevel(lvl.level)}
              className="flex w-full items-center gap-3 py-3 text-left hover:bg-[var(--bg-subtle)] transition-colors rounded-lg px-1"
            >
              {/* Icon badge */}
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)]"
                style={{
                  backgroundColor: isCompleted
                    ? "var(--success-bg)"
                    : isCurrent
                    ? "var(--badge-bg)"
                    : "var(--bg-surface-active)",
                }}
              >
                {isCompleted ? (
                  <CircleCheck size={18} className="text-[var(--success)]" />
                ) : isCurrent ? (
                  <div className="h-2 w-2 rounded-full bg-[var(--accent-label)]" />
                ) : (
                  <Lock size={16} className="text-[var(--text-ghost)]" />
                )}
              </div>

              {/* Level title + XP */}
              <div className="flex-1 min-w-0">
                <span
                  className={`text-[length:var(--type-section)] ${
                    isCurrent
                      ? "font-bold text-[var(--text-high)]"
                      : "font-semibold text-[var(--text-high)]"
                  }`}
                >
                  Level {lvl.level}
                </span>
              </div>

              {/* XP + chevron */}
              <div className="flex items-center gap-2 shrink-0">
                {isCurrent ? (
                  <span className="text-[length:var(--type-caption)] font-mono text-[var(--accent-highlight)]">
                    {currentXp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
                  </span>
                ) : (
                  <span className="text-[length:var(--type-caption)] font-mono text-[var(--text-ghost)]">
                    {lvl.xp.toLocaleString()} XP
                  </span>
                )}
                <ChevronDown
                  size={14}
                  className={`text-[var(--text-ghost)] transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </button>

            {/* Expanded content */}
            {isOpen && (
              <div className="pl-[52px] pr-1 pb-3 space-y-2">
                {/* Progress bar for current level */}
                {isCurrent && (
                  <div className="pr-6">
                    <Progress value={progressPct} className="h-1.5" />
                  </div>
                )}

                {/* Bullet descriptions */}
                {descriptions.length > 0 && (
                  <ul className="space-y-1">
                    {descriptions.map((desc, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <div
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isCurrent ? "bg-[var(--accent-label)]" : "bg-[var(--text-ghost)]"}`}
                        />
                        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
                          {renderBoldText(desc, state)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
