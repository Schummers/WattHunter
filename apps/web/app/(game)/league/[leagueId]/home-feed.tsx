"use client";

import Link from "next/link";
import { InfoCard } from "@/components/info-card";
import { OnboardingCards } from "@/components/onboarding-cards";
import { getUpcomingRaces, formatRaceDate } from "@/lib/calendar";
import { Users, Timer, ChevronRight, Calendar } from "lucide-react";

function timeUntil(dateStr: string): string {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return "now";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

interface ActiveAuction {
  id: string;
  name: string;
  status: string;
  opens_at: string;
  closes_at: string;
}

interface HomeFeedProps {
  leagueId: string;
  rosterCount: number;
  maxSlots: number;
  activeAuction: ActiveAuction | null;
}

export function HomeFeed({
  leagueId,
  rosterCount,
  maxSlots,
  activeAuction,
}: HomeFeedProps) {
  const upcomingRaces = getUpcomingRaces(3);

  return (
    <div className="min-h-full">
      <div className="px-4 pt-4 space-y-6">
        {/* Game Guide (onboarding) */}
        <OnboardingCards leagueId={leagueId} />

        {/* What's Next */}
        {(activeAuction || upcomingRaces.length > 0) && (
          <div className="space-y-2">
            <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
              What&apos;s Next
            </span>

            {/* Auction Card */}
            {activeAuction && (
              <InfoCard
                href={
                  activeAuction.status === "open"
                    ? `/league/${leagueId}/team/recruts`
                    : `/league/${leagueId}/team`
                }
                className="p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--badge-bg)]">
                      <Timer size={18} className="text-[var(--accent-label)]" />
                    </div>
                    <div>
                      <p className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                        {activeAuction.name}
                      </p>
                      <p className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
                        {activeAuction.status === "open" ? (
                          <>
                            Closes in{" "}
                            <span className="font-semibold text-[var(--warning)]">
                              {timeUntil(activeAuction.closes_at)}
                            </span>
                          </>
                        ) : (
                          <>
                            Opens in{" "}
                            <span className="font-semibold text-[var(--text-high)]">
                              {timeUntil(activeAuction.opens_at)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-[var(--text-ghost)]" />
                </div>
              </InfoCard>
            )}

            {/* Open Slots CTA */}
            {rosterCount < maxSlots && activeAuction?.status === "open" && (
              <Link
                href={`/league/${leagueId}/team/recruts`}
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--accent-default)] bg-[var(--badge-bg)] px-4 py-3 text-[length:var(--type-emphasis)] font-semibold text-[var(--accent-default)]"
              >
                <Users size={16} />
                {maxSlots - rosterCount} open slot{maxSlots - rosterCount > 1 ? "s" : ""} — Browse recruits
              </Link>
            )}

            {/* Upcoming Races */}
            {upcomingRaces.map((race) => (
              <InfoCard key={race.slug} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)]">
                    <Calendar size={18} className="text-[var(--text-mid)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                      {race.name}
                    </p>
                    <p className="text-[length:var(--type-caption)] font-mono text-[var(--text-mid)]">
                      {formatRaceDate(race.startDate, race.endDate)}
                    </p>
                  </div>
                </div>
              </InfoCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
