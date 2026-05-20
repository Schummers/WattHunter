"use client";

import { useState, useTransition } from "react";
import { FilterChips } from "@/components/filter-chips";
import { AchievementCard } from "@/components/achievement-card";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { equipAchievement } from "./actions";

const MONUMENT_GROUPS = [
  { label: "Paris-Roubaix",        prefix: "paris-roubaix" },
  { label: "Tour des Flandres",    prefix: "flandres" },
  { label: "Liège-Bastogne-Liège", prefix: "lbl" },
  { label: "Il Lombardia",         prefix: "lombardia" },
  { label: "Milan-San Remo",       prefix: "milan-sanremo" },
];

const FILTER_OPTIONS = [
  { label: "Monuments" },
  { label: "Grand Tour" },
  { label: "Budget",  disabled: true },
  { label: "Roster",  disabled: true },
];

interface AchievementsClientProps {
  leagueId: string;
  equippedSlug: string | null;
  unlockedSlugs?: string[];
  dynamicRanks?: Record<string, number>;
}

export function AchievementsClient({
  leagueId,
  equippedSlug,
  unlockedSlugs = [],
  dynamicRanks = {},
}: AchievementsClientProps) {
  const [activeFilter, setActiveFilter] = useState(0);
  const [isPending, startTransition] = useTransition();

  function handleEquip(slug: string) {
    startTransition(async () => {
      const result = await equipAchievement(leagueId, slug);
      if (result?.error) {
        console.error("Failed to equip achievement:", result.error);
      }
    });
  }

  function renderGroup(label: string, slugPrefix: string) {
    const cards = ACHIEVEMENTS.filter((a) => a.slug.startsWith(slugPrefix));
    if (cards.length === 0) return null;
    return (
      <div key={slugPrefix || label}>
        <p className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] mb-2">
          {label}
        </p>
        <div className="flex flex-col gap-2">
          {cards.map((achievement) => (
            <AchievementCard
              key={achievement.slug}
              achievement={achievement}
              unlocked={unlockedSlugs.includes(achievement.slug)}
              equipped={equippedSlug === achievement.slug}
              onEquip={handleEquip}
              dynamicRank={dynamicRanks[achievement.slug]}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)] mb-3">
          Palmares
        </h1>
        <FilterChips
          options={FILTER_OPTIONS.map(({ label, disabled }) => ({
            label,
            variant: disabled ? undefined : "default",
          }))}
          activeIndex={activeFilter}
          onChange={(i) => {
            if (!FILTER_OPTIONS[i]?.disabled) setActiveFilter(i);
          }}
        />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-5 px-4 pt-2">
        {activeFilter === 0 && (
          <>
            {MONUMENT_GROUPS.map(({ label, prefix }) =>
              renderGroup(label, prefix)
            )}
            {renderGroup("Monuments Combined", "monuments-")}
            {renderGroup("Monument Man", "monument-man")}
            {renderGroup("Classic Man", "classic-man")}
          </>
        )}

        {activeFilter === 1 && (
          <>
            {renderGroup("Giro d'Italia", "giro-")}
          </>
        )}
      </div>

      {isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim-light)]">
          <div className="rounded-lg bg-[var(--bg-surface)] px-4 py-3 text-[length:var(--type-body)] text-[var(--text-mid)]">
            Equipping…
          </div>
        </div>
      )}
    </div>
  );
}
