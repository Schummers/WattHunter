"use client";

import { Plus } from "lucide-react";
import type { RaceData } from "@/lib/race-feed-types";

type Props = {
  race: RaceData;
  leagueId: string;
  onTacticClick?: () => void;
};

export function RaceCardFuture({ race, onTacticClick }: Props) {
  const showTacticButton = race.isGtPhase && race.raceType === "stage";

  return (
    <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-app)] px-3.5 py-3 flex items-center justify-between">
      <span className="text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]/85">
        {race.raceTitle}
      </span>
      {showTacticButton ? (
        <button
          type="button"
          onClick={onTacticClick}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--accent-default)]/30 bg-[rgba(6,182,212,0.10)] text-[var(--accent-default)] hover:bg-[rgba(6,182,212,0.18)] transition-colors"
          aria-label="Place a tactic"
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
