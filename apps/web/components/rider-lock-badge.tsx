// apps/web/components/rider-lock-badge.tsx
// Small pill shown on the right side of RiderCard when a rider is co-unlock-locked.
// Design system: use --radius-pill (20px) for decorative badge per CLAUDE.md Rule #1.

import { Lock } from "lucide-react";

type Props = {
  minLevel: number;
  playersAtLevel: number;
  playersRequired?: number; // dynamic: max(2, 30% of league teams)
};

export function RiderLockBadge({ minLevel, playersAtLevel, playersRequired = 2 }: Props) {
  const tooltipText = `Unlocks when ${playersRequired} players in the league reach Lv.${minLevel}.`;
  return (
    <div
      className="flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--bg-surface-hover)] px-2 py-0.5"
      title={tooltipText}
      aria-label={tooltipText}
    >
      <Lock className="h-3 w-3 text-[var(--text-mid)]" aria-hidden />
      <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
        {playersAtLevel}/{playersRequired} · Lv.{minLevel}
      </span>
    </div>
  );
}
