"use client";

import type { AchievementTier } from "@/lib/achievements";

const RING_STYLES: Record<AchievementTier, { border: string; shadow: string; animation: string }> = {
  victory: {
    border: "#fbbf24",
    shadow: "0 0 8px #fbbf2444",
    animation: "achievement-breathe 3s ease-in-out infinite",
  },
  podium: {
    border: "#f59e0b",
    shadow: "0 0 8px #f59e0b55",
    animation: "none",
  },
  top10: {
    border: "#6b7280",
    shadow: "none",
    animation: "none",
  },
  dynamic: {
    border: "#22d3ee",
    shadow: "0 0 6px #22d3ee",
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
  const ring = locked ? { border: "#6b7280", shadow: "none", animation: "none" } : RING_STYLES[tier];

  return (
    <>
      <style>{`
        @keyframes achievement-breathe {
          0%, 100% { box-shadow: 0 0 8px #fbbf2444; }
          50%       { box-shadow: 0 0 24px #fbbf2488, 0 0 40px #fbbf2422; }
        }
        @keyframes achievement-pulse {
          0%, 100% { box-shadow: 0 0 6px #22d3ee; }
          50%       { box-shadow: 0 0 18px #22d3ee, 0 0 32px #22d3ee44; }
        }
      `}</style>
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
    </>
  );
}
