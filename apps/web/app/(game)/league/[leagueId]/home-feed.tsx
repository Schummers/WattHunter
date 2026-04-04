"use client";

import { InfoCard } from "@/components/info-card";
import { OnboardingCards } from "@/components/onboarding-cards";
import { getPhaseRaces, formatRaceDate, type UpcomingRace } from "@/lib/calendar";
import { formatRoundCountdown } from "@/lib/format";
import { getCurrentPhase, getPhaseRange, getNextPhase } from "@/lib/phases";
import { Timer, ChevronRight, Calendar } from "lucide-react";

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
  // Get all races in the current phase (extend window to match getCurrentPhase boundary)
  const now = new Date();
  const phase = getCurrentPhase(now);
  const nextPhase = getNextPhase(phase);
  const range = getPhaseRange(phase, now.getFullYear());
  const phaseStart = range.start.toISOString().slice(0, 10);
  // Use next phase start - 1 day as ceiling (matches getCurrentPhase logic)
  const phaseEnd = nextPhase
    ? new Date(now.getFullYear(), nextPhase.startMonth - 1, nextPhase.startDay - 1, 23, 59, 59)
        .toISOString().slice(0, 10)
    : range.end.toISOString().slice(0, 10);
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
                            {(() => {
                              const status = auction.status === "open" ? "open" : "scheduled";
                              const target = auction.status === "open" ? auction.closes_at : auction.opens_at;
                              const { text, urgent } = formatRoundCountdown(target, status);
                              return (
                                <span
                                  className={`font-semibold ${urgent ? "text-[var(--warning)]" : "text-[var(--text-high)]"}`}
                                >
                                  {text}
                                </span>
                              );
                            })()}
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
