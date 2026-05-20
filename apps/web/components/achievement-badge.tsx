"use client";

import type { AchievementTier } from "@/lib/achievements";

// Tier ring styles use CSS custom properties defined in globals.css (Gamification tokens section).
// A-001 victory: --tier-victory (amber-400 #fbbf24) — created as new primitive, no DS token existed.
// A-002 podium: --tier-podium → var(--warning) (amber-500 = --warning exactly).
// A-003 locked/top10: --tier-locked → var(--color-b1-8) (#40535d, nearest DS grey primitive).
// A-004 dynamic: --tier-dynamic → var(--color-cyan-400) (#22d3ee exactly).
const RING_STYLES: Record<AchievementTier, { border: string; shadow: string; animation: string }> = {
  victory: {
    border: "var(--tier-victory)",
    shadow: "0 0 8px var(--tier-victory-glow)",
    animation: "achievement-breathe 3s ease-in-out infinite",
  },
  podium: {
    border: "var(--tier-podium)",
    shadow: "0 0 8px var(--tier-podium-glow)",
    animation: "none",
  },
  top10: {
    border: "var(--tier-locked)",
    shadow: "none",
    animation: "none",
  },
  dynamic: {
    border: "var(--tier-dynamic)",
    shadow: "0 0 6px var(--tier-dynamic)",
    animation: "achievement-pulse 2.5s ease-in-out infinite",
  },
};

interface AchievementBadgeProps {
  badgeUrl: string;
  tier: AchievementTier;
  size?: number;
  locked?: boolean;
  className?: string;
}

export function AchievementBadge({
  badgeUrl,
  tier,
  size = 48,
  locked = false,
  className = "",
}: AchievementBadgeProps) {
  // locked state reuses --tier-locked (same grey as top10, no animation).
  const ring = locked ? { border: "var(--tier-locked)", shadow: "none", animation: "none" } : RING_STYLES[tier];

  return (
    // D-001: keyframes moved to globals.css (achievement-breathe, achievement-pulse) to avoid
    // duplication on multiple renders and to enable CSS custom property usage in keyframe values.
    <div
      className={`shrink-0 rounded-full overflow-hidden bg-cover bg-center ${className}`}
      style={{
        width: size,
        height: size,
        border: `2px solid ${ring.border}`,
        boxShadow: ring.shadow,
        animation: ring.animation,
        backgroundImage: `url(${badgeUrl})`,
        filter: locked ? "grayscale(70%) brightness(0.7)" : undefined,
      }}
    />
  );
}
