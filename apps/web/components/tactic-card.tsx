"use client";
import { cn } from "@/lib/utils";
import { Tag } from "@/components/pill";
import { findTactic, type TacticId, type TacticState } from "@/lib/tactics";

interface Props {
  tacticId: TacticId;
  used: number;
  state: TacticState;
  disabledReason?: string;
  onClick: () => void;
}

export function TacticCard({ tacticId, used, state, disabledReason, onClick }: Props) {
  const tactic = findTactic(tacticId);
  const Icon = tactic.icon;
  const remaining = tactic.max - used;
  const isInteractive = state === "available" || state === "active_today";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isInteractive}
      className={cn(
        "flex min-w-[140px] shrink-0 snap-start flex-col items-start gap-2 rounded-[var(--radius-lg)] border p-3 text-left transition-colors",
        state === "available" &&
          "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-surface-hover)]",
        state === "active_today" &&
          "border-[var(--accent-default)] bg-[var(--badge-bg)]",
        state === "exhausted" &&
          "cursor-not-allowed border-[var(--border-subtle)] bg-[var(--bg-subtle)] opacity-50",
        state === "disabled" &&
          "cursor-not-allowed border-[var(--border-subtle)] bg-[var(--bg-subtle)] opacity-60"
      )}
      aria-label={`${tactic.name} — ${remaining} of ${tactic.max} uses remaining`}
    >
      <div className="flex w-full items-start justify-between">
        <Icon
          className={cn(
            "size-5",
            state === "active_today"
              ? "text-[var(--accent-default)]"
              : "text-[var(--text-mid)]"
          )}
        />
        {state === "active_today" && (
          <Tag variant="highlighted" className="text-[length:var(--type-micro)]">
            Today
          </Tag>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          {tactic.name}
        </span>
        <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">
          {tactic.short}
        </span>
      </div>
      <div className="mt-auto flex w-full items-baseline justify-between">
        <span className="font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums text-[var(--text-high)]">
          {remaining}
          <span className="text-[length:var(--type-caption)] font-normal text-[var(--text-low)]">
            {" "}/ {tactic.max}
          </span>
        </span>
        {state === "disabled" && disabledReason && (
          <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">
            {disabledReason}
          </span>
        )}
      </div>
    </button>
  );
}
