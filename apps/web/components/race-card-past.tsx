"use client";

import { useState } from "react";
import Link from "next/link";
import type { RaceDataWithBreakdown } from "@/lib/race-feed-types";
import { RaceTeamBreakdown } from "./race-team-breakdown";

type Props = {
  race: RaceDataWithBreakdown;
  leagueId: string;
  defaultExpanded?: boolean;
};

export function RaceCardPast({ race, leagueId, defaultExpanded }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);

  const showGcLink = race.raceType === "stage" && race.parentRaceSlug && race.parentRaceLabel;

  return (
    <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-app)] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full px-3.5 py-3 text-left"
      >
        <span className="text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">
          {race.raceTitle}
        </span>
        <WinnerCircle initials={race.winnerTeamInitials} />
      </button>
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] px-3.5 py-3 flex flex-col gap-3">
          <RaceTeamBreakdown teams={race.teams} isGtPhase={race.isGtPhase} />
          {showGcLink && (
            <Link
              href={`/league/${leagueId}/ranking?race=${encodeURIComponent(race.parentRaceSlug!)}`}
              className="block text-center text-[length:var(--type-caption)] font-medium text-[var(--accent-default)] hover:text-[var(--accent-hover)] underline-offset-2 hover:underline"
            >
              GC Ranking →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function WinnerCircle({ initials }: { initials: string | null }) {
  if (!initials) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-app)] text-[var(--text-ghost)] text-[length:var(--type-caption)]"
        aria-hidden="true"
      >
        {"—"}
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-extrabold text-[var(--cta-text)]"
      style={{ background: "var(--cta-gradient)" }}
    >
      {initials}
    </span>
  );
}
