import type { TeamRaceResult } from "@/lib/race-feed-types";

function formatBonus(amount: number): string {
  if (amount <= 0) return "";
  return (
    Math.round(amount)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " €"
  );
}

type Props = {
  teams: TeamRaceResult[];
  isGtPhase: boolean;
};

export function RaceTeamBreakdown({ teams, isGtPhase }: Props) {
  const visibleTeams = teams.filter((t) => t.riders.length > 0);

  return (
    <div className="flex flex-col">
      {visibleTeams.map((team, i) => (
        <TeamSection key={team.teamId} team={team} isGtPhase={isGtPhase} isFirst={i === 0} />
      ))}
    </div>
  );
}

function TeamSection({
  team,
  isGtPhase,
  isFirst,
}: {
  team: TeamRaceResult;
  isGtPhase: boolean;
  isFirst: boolean;
}) {
  const bonusStr = formatBonus(team.totalBonusEur);

  return (
    <div className={`flex flex-col py-2 ${!isFirst ? "border-t border-[var(--border-subtle)]" : ""}`}>
      {/* Team header row */}
      <div className="flex items-baseline justify-between">
        <span
          className={`font-bold uppercase tracking-wider text-[length:var(--type-caption)] ${
            team.isMyTeam ? "text-[var(--accent-default)]" : "text-[var(--text-high)]"
          }`}
        >
          {team.teamName}
          {team.isMyTeam && <span className="ml-1">★</span>}
        </span>
        <span className="flex items-baseline gap-3 font-mono">
          {bonusStr && (
            <span className="text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
              {bonusStr}
            </span>
          )}
          <span className="text-[length:var(--type-caption)] font-bold text-[var(--text-high)]">
            {team.totalXp}
            <span className="ml-0.5 text-[10px] font-medium text-[var(--text-ghost)]">xp</span>
          </span>
        </span>
      </div>

      {/* Rider rows */}
      <div className="flex flex-col mt-1">
        {team.riders.map((rider) => {
          const riderBonus = formatBonus(rider.bonusEur);
          return (
            <div key={rider.riderId} className="flex items-center gap-2 pl-3 py-0.5">
              <span className="flex-1 truncate text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
                {rider.riderShortName}
              </span>
              {isGtPhase && rider.role && (
                <span className="rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)] bg-[var(--bg-surface-active)]">
                  {rider.role}
                </span>
              )}
              <span className="font-mono text-[length:var(--type-caption)] font-semibold text-[var(--text-mid)] min-w-[68px] text-right">
                {riderBonus}
              </span>
              <span className="font-mono text-[length:var(--type-caption)] font-semibold text-[var(--text-mid)] min-w-[48px] text-right">
                {rider.xpGained}
                <span className="ml-0.5 text-[10px] font-medium text-[var(--text-ghost)]">xp</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
