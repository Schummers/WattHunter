// apps/web/components/rider-lock-badge.tsx
// Small pill shown on the right side of RiderCard when a rider is co-unlock-locked.
// Design system: use --radius-pill (20px) for decorative badge per CLAUDE.md Rule #1.

import { Lock } from "lucide-react";

type Props = {
  minLevel: number;
  playersNeeded: number;
};

export function RiderLockBadge({ minLevel, playersNeeded }: Props) {
  const playerWord = playersNeeded === 1 ? "player" : "players";
  return (
    <div
      className="flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--bg-surface-hover)] px-2 py-0.5"
      title={`Unlock when ${playersNeeded} more ${playerWord} reach Lv.${minLevel}`}
    >
      <Lock className="h-3 w-3 text-[var(--text-mid)]" aria-hidden />
      <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
        Lv.{minLevel} · {playersNeeded} needed
      </span>
    </div>
  );
}
