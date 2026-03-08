"use client";

import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { getNextLevel, getProgressPct, getNewUnlocks, getLevelByNumber } from "@/lib/levels";

interface TeamLevelCardProps {
  leagueId: string;
  currentLevel: number;
  currentXp: number;
  hideHeader?: boolean;
}

export function TeamLevelCard({
  leagueId,
  currentLevel,
  currentXp,
  hideHeader = false,
}: TeamLevelCardProps) {
  const next = getNextLevel(currentLevel);
  const current = getLevelByNumber(currentLevel);
  const pct = getProgressPct(currentXp, currentLevel);
  const isMaxLevel = !next;
  const unlocks = isMaxLevel ? [] : getNewUnlocks(currentLevel + 1);

  const xpLabel = isMaxLevel
    ? `${currentXp} XP`
    : `${currentXp} / ${next.xp} XP`;

  const card = (
    <div
      className={`relative overflow-hidden rounded-xl p-4 ${
        !hideHeader
          ? "hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all duration-200"
          : ""
      }`}
    >
      {/* Mesh gradient background */}
      <div
        className="absolute inset-0 animate-mesh-slow"
        style={{
          backgroundColor: "#020617",
          backgroundImage: [
            "radial-gradient(circle at 20% 20%, #0b1120 0%, transparent 55%)",
            "radial-gradient(circle at 70% 25%, #1e293b 0%, transparent 50%)",
            "radial-gradient(circle at 30% 75%, rgba(6, 182, 212, 0.25) 0%, transparent 50%)",
            "radial-gradient(circle at 80% 70%, rgba(34, 211, 238, 0.18) 0%, transparent 45%)",
          ].join(", "),
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-3">
        {/* Header */}
        {!hideHeader && (
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[var(--text-mid)]">
              Team level
            </span>
            <span className="text-[12px] font-medium text-[var(--text-low)]">
              All levels &rarr;
            </span>
          </div>
        )}

        {/* XP text */}
        <span className="text-[12px] font-medium text-[var(--text-mid)]">
          <span className="font-mono">{currentXp}</span>
          {!isMaxLevel && (
            <>
              {" / "}
              <span className="font-mono">{next.xp}</span>
            </>
          )}
          {" XP"}
        </span>

        {/* Progress row: current badge + bar + next badge */}
        <div className="flex items-center gap-2">
          {/* Current level badge */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)]">
            <span className="text-sm font-bold text-[var(--text-high)]">
              {currentLevel}
            </span>
          </div>

          {/* Progress bar */}
          <Progress value={pct} className="h-1.5 flex-1" />

          {/* Next level badge */}
          {!isMaxLevel && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)]">
              <span className="text-sm font-medium text-[var(--text-ghost)]">
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
                className="rounded-full border border-[var(--border-default)] px-2.5 py-0.5 text-[11px] text-[var(--text-mid)]"
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
    <Link href={`/league/${leagueId}/team/levels`}>
      {card}
    </Link>
  );
}
