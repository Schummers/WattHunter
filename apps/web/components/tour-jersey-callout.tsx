import { AchievementBadge } from "./achievement-badge";
import type { AchievementTier } from "@/lib/achievements";

interface Props {
  badgeUrl: string;
  bannerUrl: string | null;
  tier: AchievementTier;
  achievementName: string;
}

/**
 * Home page callout shown when the user's own team currently wears a live
 * Grand Tour jersey (see lib/tour-jerseys.ts) — mirrors the badge/banner
 * treatment used on the ranking card and past-race winner card.
 */
export function TourJerseyCallout({ badgeUrl, bannerUrl, tier, achievementName }: Props) {
  return (
    <div className="relative mx-4 mt-4 flex items-center gap-3 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
      {bannerUrl && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bannerUrl})` }}
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
      <div className="relative z-10 shrink-0">
        <AchievementBadge badgeUrl={badgeUrl} tier={tier} size={40} />
      </div>
      <div className="relative z-10 flex flex-col min-w-0">
        <span className="text-[length:var(--type-micro)] font-semibold uppercase tracking-wide text-[var(--accent-label)]">
          Live
        </span>
        <span className="text-[length:var(--type-body)] font-semibold text-[var(--text-high)] truncate">
          Your team wears the {achievementName}
        </span>
      </div>
    </div>
  );
}
