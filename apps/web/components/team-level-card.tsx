"use client";

import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { getNextLevel, getProgressPct, getNewUnlocks, getLevelByNumber } from "@/lib/levels";

interface TeamLevelCardProps {
  leagueId: string;
  currentLevel: number;
  currentXp: number;
  teamName?: string;
  hideHeader?: boolean;
  variant?: "home" | "default";
}

export function TeamLevelCard({
  leagueId,
  currentLevel,
  currentXp,
  teamName,
  hideHeader = false,
  variant = "default",
}: TeamLevelCardProps) {
  const next = getNextLevel(currentLevel);
  const current = getLevelByNumber(currentLevel);
  const pct = getProgressPct(currentXp, currentLevel);
  const isMaxLevel = !next;
  const unlocks = isMaxLevel ? [] : getNewUnlocks(currentLevel + 1);

  const card = (
    <div
      className={`rounded-xl border p-4 transition-colors duration-200 ${
        variant === "home"
          ? "border-[var(--border-subtle)] bg-[var(--bg-app)]/80 backdrop-blur-sm hover:bg-[var(--bg-surface)]"
          : hideHeader
            ? "border-transparent bg-[var(--bg-surface)]"
            : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]"
      }`}
    >
      <div className="flex flex-col gap-3">
        {/* Header */}
        {!hideHeader && (
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[var(--text-mid)]">
              {teamName ?? "Team level"}
            </span>
            <span className="text-[12px] font-medium link-tertiary">
              All levels &rarr;
            </span>
          </div>
        )}

        {/* Progress row: current badge + (XP text above bar) + next badge */}
        <div className="flex items-center gap-2">
          {/* Current level badge */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5">
            <span className="text-sm font-bold text-[var(--text-high)]">
              {currentLevel}
            </span>
          </div>

          {/* XP text + progress bar stacked */}
          <div className="flex-1 flex flex-col gap-1">
            <span className="text-[12px] font-medium text-[var(--text-mid)]">
              <span className="font-mono">{currentXp.toLocaleString()}</span>
              {!isMaxLevel && (
                <>
                  {" / "}
                  <span className="font-mono">{next.xp.toLocaleString()}</span>
                </>
              )}
              {" XP"}
            </span>
            <Progress value={pct} className="h-1.5" />
          </div>

          {/* Next level badge */}
          {!isMaxLevel && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5">
              <span className="text-sm font-bold text-[var(--text-mid)]">
                {currentLevel + 1}
              </span>
            </div>
          )}
        </div>

        {/* Unlock pills */}
        <div className="flex flex-wrap gap-1.5">
          {isMaxLevel ? (
            <span className="text-[11px] text-[var(--text-mid)]">
              Max level reached
            </span>
          ) : (
            unlocks.map((label) => (
              <span
                key={label}
                className="rounded-full bg-[var(--text-high)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--bg-app)]"
              >
                {label}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );

  if (hideHeader) {
    return card;
  }

  return (
    <Link href={`/league/${leagueId}/levels`}>
      {card}
    </Link>
  );
}
