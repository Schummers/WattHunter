// apps/web/components/remontada-boost-banner.tsx
// Spec §3.7 — banner displayed on Team > GT sub-tab during an active Remontada Boost.
// Design system: use --accent-default tokens, --radius-lg, text-[length:var(--type-*)] tokens only.

import { Flame } from "lucide-react";

type RemontadaBoostBannerProps = {
  stagesRemaining: number;
  multiplier: number;
  overtakenTeamName: string | null;
};

export function RemontadaBoostBanner({
  stagesRemaining,
  multiplier,
  overtakenTeamName,
}: RemontadaBoostBannerProps) {
  const stageWord = stagesRemaining === 1 ? "stage" : "stages";
  return (
    <div
      className="mx-4 mb-3 mt-2 rounded-[var(--radius-lg)] border border-[var(--accent-default)]/50 bg-[var(--accent-default)]/10 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-[var(--accent-default)]" aria-hidden />
        <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          Remontada Boost active
        </span>
      </div>
      <p className="mt-1 text-[length:var(--type-body)] text-[var(--text-high)]">
        {multiplier}x points for the next {stagesRemaining} {stageWord}
        <span className="text-[var(--text-mid)]">
          {" "}
          · {stagesRemaining} {stageWord} remaining
        </span>
      </p>
      {overtakenTeamName && (
        <p className="mt-0.5 text-[length:var(--type-caption)] text-[var(--text-mid)]">
          Triggered by overtaking {overtakenTeamName}
        </p>
      )}
    </div>
  );
}
