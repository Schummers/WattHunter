import { AchievementBadge } from "./achievement-badge";
import type { AchievementTier } from "@/lib/achievements";

interface JerseyRow {
  jerseyType: string;
  teamName: string;
  isMe: boolean;
  badgeUrl: string;
  tier: AchievementTier;
  achievementName: string;
}

interface Props {
  rows: JerseyRow[];
}

/**
 * Home page board showing who currently holds each live Grand Tour jersey
 * (see lib/tour-jerseys.ts) — league-wide, not just the viewer's own team.
 * Renders nothing if no jersey has a holder yet (e.g. outside the Tour, or
 * before the first classification syncs).
 */
export function TourJerseyBoard({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <div className="mx-4 mt-4 flex flex-col divide-y divide-[var(--border-subtle)] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
      {rows.map((row) => (
        <div key={row.jerseyType} className="flex items-center gap-3 px-4 py-2.5">
          <AchievementBadge badgeUrl={row.badgeUrl} tier={row.tier} size={32} />
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[length:var(--type-micro)] text-[var(--text-mid)] truncate">
              {row.achievementName}
            </span>
            <span className="text-[length:var(--type-body)] font-semibold text-[var(--text-high)] truncate">
              {row.teamName}
              {row.isMe && <span className="text-[var(--text-mid)] font-normal"> (You)</span>}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
