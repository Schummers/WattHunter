"use client";

import type { Achievement } from "@/lib/achievements";
import { AchievementBadge } from "@/components/achievement-badge";

const TIER_LABEL: Record<string, string> = {
  victory: "Victory",
  podium:  "Podium",
  top10:   "Top 10",
  dynamic: "Live",
};

interface AchievementCardProps {
  achievement: Achievement;
  unlocked: boolean;
  equipped: boolean;
  onEquip: (slug: string) => void;
  dynamicRank?: number;
}

export function AchievementCard({ achievement, unlocked, equipped, onEquip, dynamicRank }: AchievementCardProps) {
  const { slug, name, condition, tier, badgeUrl, bannerUrl } = achievement;

  return (
    <div
      style={{
        borderRadius: 20,
        overflow: "hidden",
        border: equipped
          ? "1.5px solid var(--accent-default)"
          : "1px solid rgba(255,255,255,0.08)",
        background: "var(--bg-surface)",
        boxShadow: equipped ? "0 0 0 1px var(--accent-default)" : "none",
      }}
    >
      {/* Banner preview — always full color */}
      <div style={{ height: 56, position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${bannerUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.08) 100%)",
          }}
        />
      </div>

      {/* Body — badge + text + right action, all vertically centered */}
      <div style={{ padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
        {/* Badge */}
        <AchievementBadge badgeUrl={badgeUrl} tier={tier} size={40} locked={false} />

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "var(--type-emphasis)",
              fontWeight: 700,
              color: unlocked ? "var(--text-high)" : "var(--text-low)",
              lineHeight: 1.2,
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: "var(--type-caption)",
              color: unlocked ? "var(--text-mid)" : "var(--text-ghost)",
              lineHeight: 1.4,
              marginTop: 2,
            }}
          >
            {unlocked ? condition : `Unlock: ${condition}`}
          </div>
        </div>

        {/* Right action — vertically centered */}
        <RightAction
          tier={tier}
          unlocked={unlocked}
          equipped={equipped}
          onClick={() => onEquip(slug)}
          dynamicRank={dynamicRank}
        />
      </div>
    </div>
  );
}

function RightAction({
  tier,
  unlocked,
  equipped,
  onClick,
  dynamicRank,
}: {
  tier: string;
  unlocked: boolean;
  equipped: boolean;
  onClick: () => void;
  dynamicRank?: number;
}) {
  // Equipped: cyan filled checkmark
  if (equipped) {
    return (
      <span
        style={{
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 32,
          height: 26,
          padding: "0 8px",
          fontSize: "var(--type-caption)",
          fontWeight: 700,
          color: "var(--accent-default)",
          borderRadius: 6,
          border: "1px solid var(--accent-default)",
          background: "rgba(6,182,212,0.12)",
        }}
        aria-label="Equipped"
      >
        ✓
      </span>
    );
  }

  // Unlocked, not equipped: cyan outline "Equip" button
  if (unlocked) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          flexShrink: 0,
          height: 26,
          padding: "0 10px",
          fontSize: "var(--type-micro)",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--accent-default)",
          borderRadius: 6,
          border: "1px solid var(--accent-default)",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        Equip
      </button>
    );
  }

  // Dynamic locked with known rank: show "#N in league"
  if (tier === "dynamic" && dynamicRank != null) {
    return (
      <span
        style={{
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          height: 22,
          padding: "0 8px",
          fontSize: "var(--type-micro)",
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: "var(--text-mid)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.08)",
          whiteSpace: "nowrap",
        }}
      >
        #{dynamicRank} in league
      </span>
    );
  }

  // Locked: muted tier chip
  return (
    <span
      style={{
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        height: 22,
        padding: "0 8px",
        fontSize: "var(--type-micro)",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--text-ghost)",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}
