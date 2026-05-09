import type { TeamRaceResult } from "@/lib/race-feed-types";
import { formatBonusEur, formatXp } from "@/lib/race-feed-helpers";

function formatRiderBonusEur(amount: number): string {
  if (amount <= 0) return "—";
  const withSpaces = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${withSpaces}€`;
}

type Props = {
  teams: TeamRaceResult[];
  isGtPhase: boolean;
};

export function RaceTeamBreakdown({ teams, isGtPhase }: Props) {
  const visibleTeams = teams.filter((t) => t.riders.length > 0);

  return (
    <div className="flex flex-col gap-1.5">
      {visibleTeams.map((team) => (
        <TeamSection key={team.teamId} team={team} isGtPhase={isGtPhase} />
      ))}
    </div>
  );
}

function TeamSection({ team, isGtPhase }: { team: TeamRaceResult; isGtPhase: boolean }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between py-1">
        <span
          className={`font-bold uppercase tracking-wider text-[length:var(--type-caption)] ${
            team.isMyTeam ? "text-[var(--accent-default)]" : "text-[var(--text-high)]"
          }`}
        >
          {team.teamName}
          {team.isMyTeam && <span className="ml-1">★</span>}
        </span>
        <span className="flex items-center gap-3 font-mono">
          <span className="text-[length:var(--type-caption)] font-semibold text-[var(--text-mid)]">
            {formatBonusEur(team.totalBonusEur)}
          </span>
          <span className="text-[length:var(--type-stat-small)] font-bold text-[var(--accent-highlight)]">
            {formatXp(team.totalXp)}
          </span>
        </span>
      </div>
      <div className="flex flex-col">
        {team.riders.map((rider) => (
          <div key={rider.riderId} className="flex items-center gap-2 pl-3 py-0.5">
            <span className="flex-1 truncate text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
              {rider.riderShortName}
            </span>
            {isGtPhase && rider.role && (
              <span className="rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-[var(--text-mid)] bg-[var(--bg-surface-active)]">
                {rider.role}
              </span>
            )}
            <span className="font-mono text-[10px] font-semibold text-[var(--success)] min-w-[68px] text-right">
              {formatRiderBonusEur(rider.bonusEur)}
            </span>
            <span className="font-mono text-[length:var(--type-caption)] font-bold text-[var(--accent-highlight)] min-w-[44px] text-right">
              {formatXp(rider.xpGained)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
