"use client";

import { useTransition } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AchievementCard } from "@/components/achievement-card";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { equipAchievement } from "./actions";

const MONUMENT_GROUPS = [
  { label: "Paris-Roubaix",       prefix: "paris-roubaix" },
  { label: "Tour des Flandres",   prefix: "flandres" },
  { label: "Liège-Bastogne-Liège", prefix: "lbl" },
  { label: "Il Lombardia",        prefix: "lombardia" },
  { label: "Milan-San Remo",      prefix: "milan-sanremo" },
];

interface AchievementsClientProps {
  leagueId: string;
  equippedSlug: string | null;
  unlockedSlugs?: string[];
}

export function AchievementsClient({
  leagueId,
  equippedSlug,
  unlockedSlugs = [],
}: AchievementsClientProps) {
  const [isPending, startTransition] = useTransition();

  function handleEquip(slug: string) {
    startTransition(async () => {
      await equipAchievement(leagueId, slug);
    });
  }

  return (
    <div className="pb-24">
      <Tabs defaultValue="monuments">
        <TabsList variant="line" className="w-full px-4">
          <TabsTrigger value="monuments">Monuments</TabsTrigger>
          <TabsTrigger value="budget" disabled>Budget</TabsTrigger>
          <TabsTrigger value="roster" disabled>Roster</TabsTrigger>
          <TabsTrigger value="league" disabled>League</TabsTrigger>
        </TabsList>

        <TabsContent value="monuments" className="mt-0">
          <div className="flex flex-col gap-5 px-4 pt-4">
            {MONUMENT_GROUPS.map(({ label, prefix }) => {
              const cards = ACHIEVEMENTS.filter((a) => a.slug.startsWith(prefix));
              return (
                <div key={prefix}>
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
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-lg bg-[var(--bg-surface)] px-4 py-3 text-[length:var(--type-body)] text-[var(--text-mid)]">
            Equipping…
          </div>
        </div>
      )}
    </div>
  );
}
