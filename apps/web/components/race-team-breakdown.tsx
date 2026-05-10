import type { TeamRaceResult } from "@/lib/race-feed-types";

function formatBonus(amount: number): string {
  if (amount <= 0) return "";
  const k = amount / 1000;
  const formatted = k % 1 === 0 ? String(Math.round(k)) : k.toFixed(1);
  return formatted + " k€";
}

function formatXp(xp: number): string {
  // Max 1 decimal, trailing zeros stripped
  const rounded = Math.round(xp * 10) / 10;
  return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
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
      {/* Team header row — same fixed column widths as rider rows for alignment */}
      <div className="flex items-baseline justify-between">
        <span
          className={`font-bold uppercase tracking-wider text-[length:var(--type-caption)] ${
            team.isMyTeam ? "text-[var(--accent-default)]" : "text-[var(--text-high)]"
          }`}
        >
          {team.teamName}
          {team.isMyTeam && <span className="ml-1">&#9733;</span>}
        </span>
        {/* Fixed 2-column block with gap-4 separator: bonus | xp */}
        <div className="flex items-baseline gap-4 font-mono shrink-0">
          <span className="w-[64px] text-right text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
            {bonusStr}
          </span>
          <span className="w-[44px] text-right text-[length:var(--type-caption)] font-bold text-[var(--text-high)]">
            {formatXp(team.totalXp)}
            <span className="ml-0.5 text-[10px] font-medium text-[var(--text-ghost)]">xp</span>
          </span>
        </div>
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
              {/* Fixed 2-column block with gap-4 separator: bonus | xp */}
              <div className="flex items-baseline gap-4 font-mono shrink-0">
                <span className="w-[64px] text-right text-[length:var(--type-caption)] font-semibold text-[var(--text-mid)]">
                  {riderBonus}
                </span>
                <span className="w-[44px] text-right text-[length:var(--type-caption)] font-semibold text-[var(--text-mid)]">
                  {formatXp(rider.xpGained)}
                  <span className="ml-0.5 text-[10px] font-medium text-[var(--text-ghost)]">xp</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
