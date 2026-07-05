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
    // overflow-visible so the floating label can escape the border
    <div className="relative rounded-[var(--radius-compound)] border border-[var(--border-default)] bg-[var(--bg-app)]">
      {/* Floating label — centered on the top border line */}
      <span
        className="absolute left-3 text-[length:var(--type-micro)] font-semibold text-[var(--text-low)] z-10 whitespace-nowrap leading-3"
        style={{
          top: -6,
          paddingLeft: 4,
          paddingRight: 4,
          background: "var(--bg-app)",
          borderRadius: 2,
        }}
      >
        {race.raceTitle}
      </span>

      {/* Inner wrapper clips the banner to the card radius */}
      <div className="overflow-hidden rounded-[var(--radius-compound)]">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="relative flex items-center justify-between w-full px-3.5 py-3 text-left"
        >
          {race.winnerTeamBannerUrl && (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${race.winnerTeamBannerUrl})` }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to right, rgba(12,14,18,0.92) 0%, rgba(12,14,18,0.75) 50%, rgba(12,14,18,0.35) 100%)",
                }}
              />
            </>
          )}
          <div className="relative z-10 flex flex-col gap-0.5 min-w-0 mr-3">
            <span className="text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)] truncate">
              {race.winnerTeamName ?? race.raceTitle}
            </span>
            {hasBadge && race.winnerTeamAchievementName && (
              <span
                className="text-[length:var(--type-caption)] font-semibold truncate"
                style={{ color: "var(--accent-default)" }}
              >
                {race.winnerTeamAchievementName}
              </span>
            )}
          </div>
          <div className="relative z-10 shrink-0">
            <WinnerCircle
              initials={race.winnerTeamInitials}
              badgeUrl={race.winnerTeamBadgeUrl}
              tier={race.winnerTeamAchievementTier}
            />
          </div>
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
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-app)] text-[var(--text-ghost)] text-[length:var(--type-caption)] shrink-0"
        aria-hidden="true"
      >
        {"—"}
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[length:var(--type-micro)] font-extrabold text-[var(--cta-text)] shrink-0"
      style={{ background: "var(--cta-gradient)" }}
    >
      {initials}
    </span>
  );
}
