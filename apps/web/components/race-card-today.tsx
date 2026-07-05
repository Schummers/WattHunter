import Link from "next/link";
import type { RaceDataWithBreakdown } from "@/lib/race-feed-types";
import { RaceTeamBreakdown } from "./race-team-breakdown";
import { AchievementBadge } from "./achievement-badge";
import type { AchievementTier } from "@/lib/achievements";

type Props = {
  race: RaceDataWithBreakdown;
  leagueId: string;
};

export function RaceCardToday({ race, leagueId }: Props) {
  const showGcLink = race.raceType === "stage" && race.parentRaceSlug && race.parentRaceLabel;
  const hasBadge = !!race.winnerTeamBadgeUrl;

  return (
    <div className="rounded-[var(--radius-compound)] border border-[var(--border-default)] bg-[var(--bg-app)] px-3.5 py-3.5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
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
        <WinnerAvatar
          initials={race.winnerTeamInitials}
          badgeUrl={race.winnerTeamBadgeUrl}
          tier={race.winnerTeamAchievementTier}
        />
      </div>
      {race.jerseys.length > 0 && (
        <>
          <div className="my-3 h-px bg-[var(--border-subtle)]" />
          <div className="flex items-center gap-3">
            {race.jerseys.map((j) => (
              <div key={j.jerseyType} className="flex items-center gap-1.5 min-w-0">
                <AchievementBadge badgeUrl={j.badgeUrl} tier={j.tier} size={22} />
                <span className="text-[length:var(--type-micro)] text-[var(--text-mid)] truncate">
                  {j.teamName}
                  {j.isMyTeam && " (You)"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
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
            className="block text-center text-[length:var(--type-caption)] font-medium text-[var(--accent-default)] hover:text-[var(--accent-hover)] underline-offset-2 hover:underline"
          >
            GC Ranking →
          </Link>
        </>
      )}
    </div>
  );
}

function WinnerAvatar({
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
      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[length:var(--type-micro)] font-extrabold text-[var(--cta-text)] shrink-0"
      style={{ background: "var(--cta-gradient)" }}
    >
      {initials}
    </span>
  );
}
