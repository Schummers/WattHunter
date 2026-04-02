"use client";

import { InfoCard } from "@/components/info-card";
import { OnboardingCards } from "@/components/onboarding-cards";
import { getPhaseRaces, formatRaceDate, type UpcomingRace } from "@/lib/calendar";
import { getCurrentPhase, getPhaseRange } from "@/lib/phases";
import { Timer, ChevronRight, Calendar } from "lucide-react";

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
  activeAuction: ActiveAuction | null;
  nextAuctionLabel: string | null;
}

type FeedItem =
  | { type: "auction-active"; date: string; data: ActiveAuction }
  | { type: "auction-next"; date: string; label: string }
  | { type: "race"; date: string; data: UpcomingRace };

export function HomeFeed({
  leagueId,
  activeAuction,
  nextAuctionLabel,
}: HomeFeedProps) {
  // Get all races in the current phase
  const now = new Date();
  const phase = getCurrentPhase(now);
  const range = getPhaseRange(phase, now.getFullYear());
  const phaseStart = range.start.toISOString().slice(0, 10);
  const phaseEnd = range.end.toISOString().slice(0, 10);
  const phaseRaces = getPhaseRaces(phaseStart, phaseEnd);

  // Build unified chronological feed
  const feedItems: FeedItem[] = [];

  // Add races
  for (const race of phaseRaces) {
    feedItems.push({ type: "race", date: race.startDate, data: race });
  }

  // Add auction card
  if (activeAuction) {
    const auctionDate = activeAuction.status === "open"
      ? activeAuction.opens_at.slice(0, 10)
      : activeAuction.opens_at.slice(0, 10);
    feedItems.push({ type: "auction-active", date: auctionDate, data: activeAuction });
  } else if (nextAuctionLabel) {
    // Extract date from label for sorting (e.g. "Round 1 — Apr 2")
    // Place it after all races by using the phase end date as fallback
    feedItems.push({ type: "auction-next", date: phaseEnd, label: nextAuctionLabel });
  }

  // Sort chronologically
  feedItems.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="min-h-full">
      <div className="px-4 pt-4 space-y-6">
        {/* Game Guide (onboarding) */}
        <OnboardingCards leagueId={leagueId} />

        {/* What's Next */}
        {feedItems.length > 0 && (
          <div className="space-y-3">
            <span className="mb-3 block text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
              What&apos;s Next
            </span>

            {/* Chronological feed items */}
            {feedItems.map((item) => {
              if (item.type === "auction-active") {
                const auction = item.data;
                return (
                  <InfoCard
                    key={`auction-${auction.id}`}
                    href={`/league/${leagueId}/team/market`}
                    className="p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--badge-bg)]">
                          <Timer size={18} className="text-[var(--accent-label)]" />
                        </div>
                        <div>
                          <p className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                            {auction.name}
                          </p>
                          <p className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
                            {auction.status === "open" ? (
                              <>
                                Closes in{" "}
                                <span className="font-semibold text-[var(--warning)]">
                                  {timeUntil(auction.closes_at)}
                                </span>
                              </>
                            ) : (
                              <>
                                Opens in{" "}
                                <span className="font-semibold text-[var(--text-high)]">
                                  {timeUntil(auction.opens_at)}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-[length:var(--type-caption)] text-[var(--text-low)] transition-colors hover:text-[var(--text-mid)]">
                        Market
                        <ChevronRight size={14} />
                      </span>
                    </div>
                  </InfoCard>
                );
              }

              if (item.type === "auction-next") {
                return (
                  <InfoCard
                    key="auction-next"
                    href={`/league/${leagueId}/team/market`}
                    className="p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--badge-bg)]">
                          <Timer size={18} className="text-[var(--accent-label)]" />
                        </div>
                        <div>
                          <p className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                            Next auction
                          </p>
                          <p className="text-[length:var(--type-caption)] font-mono text-[var(--text-mid)]">
                            {item.label}
                          </p>
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-[length:var(--type-caption)] text-[var(--text-low)] transition-colors hover:text-[var(--text-mid)]">
                        Market
                        <ChevronRight size={14} />
                      </span>
                    </div>
                  </InfoCard>
                );
              }

              // Race item
              const race = item.data;
              return (
                <InfoCard key={race.slug} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface-hover)]">
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
