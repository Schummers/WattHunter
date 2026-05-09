import Link from "next/link";
import type { RaceDataWithBreakdown } from "@/lib/race-feed-types";
import { RaceTeamBreakdown } from "./race-team-breakdown";

type Props = {
  race: RaceDataWithBreakdown;
  leagueId: string;
};

export function RaceCardToday({ race, leagueId }: Props) {
  const showGcLink = race.raceType === "stage" && race.parentRaceSlug && race.parentRaceLabel;

  return (
    <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-app)] px-3.5 py-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">
          {race.raceTitle}
        </span>
        <WinnerAvatar initials={race.winnerTeamInitials} />
      </div>
      {/* Divider */}
      <div className="my-3 h-px bg-[var(--border-subtle)]" />
      {/* Breakdown */}
      <RaceTeamBreakdown teams={race.teams} isGtPhase={race.isGtPhase} />
      {/* GC link */}
      {showGcLink && (
        <>
          <div className="my-3 h-px bg-[var(--border-subtle)]" />
          <Link
            href={`/league/${leagueId}/ranking?race=${encodeURIComponent(race.parentRaceSlug!)}`}
            className="block w-full text-center rounded-md px-3 py-2 text-[length:var(--type-caption)] font-medium text-[var(--accent-default)] bg-[rgba(6,182,212,0.06)] hover:bg-[rgba(6,182,212,0.10)] transition-colors"
          >
            View GC standings for {race.parentRaceLabel} →
          </Link>
        </>
      )}
    </div>
  );
}

function WinnerAvatar({ initials }: { initials: string | null }) {
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
