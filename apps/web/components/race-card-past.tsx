"use client";

import { useState } from "react";
import Link from "next/link";
import type { RaceDataWithBreakdown } from "@/lib/race-feed-types";
import { RaceTeamBreakdown } from "./race-team-breakdown";
import { AchievementBadge } from "./achievement-badge";
import type { AchievementTier } from "@/lib/achievements";

type Props = {
  race: RaceDataWithBreakdown;
  leagueId: string;
  defaultExpanded?: boolean;
};

export function RaceCardPast({ race, leagueId, defaultExpanded }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);

  const showGcLink = race.raceType === "stage" && race.parentRaceSlug && race.parentRaceLabel;
  const hasBadge = !!race.winnerTeamBadgeUrl;

  return (
    <div className="rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-app)] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full px-3.5 py-3 text-left"
      >
        <div className="flex flex-col gap-0.5 min-w-0 mr-3">
          <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">
            {race.raceTitle}
          </span>
          {hasBadge ? (
            <>
              <span className="text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)] truncate">
                {race.winnerTeamName}
              </span>
              <span
                className="text-[length:var(--type-micro)] font-medium truncate"
                style={{ color: "var(--accent-default)" }}
              >
                {race.winnerTeamAchievementName}
              </span>
            </>
          ) : (
            <span className="text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)] truncate">
              {race.winnerTeamName ?? race.raceTitle}
            </span>
          )}
        </div>
        <WinnerCircle
          initials={race.winnerTeamInitials}
          badgeUrl={race.winnerTeamBadgeUrl}
          tier={race.winnerTeamAchievementTier}
        />
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

function WinnerCircle({
  initials,
  badgeUrl,
  tier,
}: {
  initials: string | null;
  badgeUrl: string | null;
  tier: AchievementTier | null;
}) {
  if (badgeUrl && tier) {
    return <AchievementBadge badgeUrl={badgeUrl} tier={tier} size={40} locked={false} />;
  }
  if (!initials) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-app)] text-[var(--text-ghost)] text-[length:var(--type-caption)] shrink-0"
        aria-hidden="true"
      >
        {"—"}
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-extrabold text-[var(--cta-text)] shrink-0"
      style={{ background: "var(--cta-gradient)" }}
    >
      {initials}
    </span>
  );
}
