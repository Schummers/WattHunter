"use client";

import { useRef, useCallback } from "react";
import { Progress } from "@/components/ui/progress";

interface BrandCardProps {
  xp: number;
  level: number;
  progressPct: number;
  rank: number;
  teamCount: number;
  nextLevelXp: number | null;
  isMaxLevel: boolean;
}

export function BrandCard({
  xp,
  level,
  progressPct,
  rank,
  teamCount,
  nextLevelXp,
  isMaxLevel,
}: BrandCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleClick = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    el.classList.add("clicked");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      el.classList.remove("clicked");
    }, 600);
  }, []);

  return (
    <div
      ref={cardRef}
      className="xp-card"
      onClick={handleClick}
    >
      {/* ::before = beam border, ::after = outer glow (via CSS) */}
      <div className="xp-card-body">
        {/* ::after = SVG noise (via CSS) */}
        <div className="xp-content">
          {/* Top label */}
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            Total XP Season
          </span>

          {/* XP hero number + ranking pill */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[length:var(--type-display)] font-black font-mono leading-none tracking-tight text-[var(--accent-highlight)]">
              {xp.toLocaleString()}
            </span>
            <span className="text-[length:var(--type-caption)] font-semibold text-[var(--text-low)]">
              XP
            </span>
            <span className="ml-auto flex items-baseline gap-1 rounded-full bg-white/5 px-3 py-0.5">
              <span className="text-[length:var(--type-emphasis)] font-bold font-mono text-[var(--text-high)]">
                # {rank}
              </span>
              <span className="text-[length:var(--type-caption)] font-medium font-mono text-[var(--text-mid)]">
                / {teamCount}
              </span>
            </span>
          </div>

          {/* Level + percentage */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
              Level {level}{!isMaxLevel && ` → ${level + 1}`}
            </span>
            <span className="text-[length:var(--type-caption)] font-mono text-[var(--text-mid)]">
              {progressPct}%
            </span>
          </div>

          {/* Progress bar — tight spacing */}
          <div className="mt-1">
            <Progress value={progressPct} className="h-1.5" />
          </div>

          {/* XP targets */}
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[length:var(--type-caption)] font-mono text-[var(--text-low)]">
              {xp.toLocaleString()}
            </span>
            <span className="text-[length:var(--type-caption)] font-mono text-[var(--text-low)]">
              {isMaxLevel ? "MAX" : nextLevelXp?.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
