"use client";

import { Plus } from "lucide-react";
import type { RaceData } from "@/lib/race-feed-types";

type Props = {
  race: RaceData;
  leagueId: string;
  onTacticClick?: () => void;
  isInProgress?: boolean;
};

export function RaceCardFuture({ race, onTacticClick, isInProgress }: Props) {
  const showTacticButton = race.isGtPhase && race.raceType === "stage";

  return (
    <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-app)] px-3.5 py-3 flex items-center justify-between">
      <span className="text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]/85">
        {race.raceTitle}
      </span>
      {showTacticButton ? (
        <button
          type="button"
          onClick={isInProgress ? undefined : onTacticClick}
          disabled={isInProgress}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--accent-default)]/30 bg-[rgba(6,182,212,0.10)] text-[var(--accent-default)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:bg-[rgba(6,182,212,0.18)]"
          aria-label={isInProgress ? "Race in progress" : "Place a tactic"}
        >
          <Plus size={14} />
        </button>
      ) : (
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-app)] text-[var(--text-ghost)] text-[length:var(--type-caption)]"
          aria-hidden="true"
        >
          {"—"}
        </span>
      )}
    </div>
  );
}
