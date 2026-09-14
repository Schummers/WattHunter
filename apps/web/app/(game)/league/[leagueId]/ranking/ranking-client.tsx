"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SegmentedControl } from "@/components/segmented-control";
import { MovementTag } from "@/components/movement-tag";
import { AchievementBadge } from "@/components/achievement-badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatThousands, countryCodeToFlag } from "@/lib/format";
import { resolvePhotoUrl } from "@/lib/photo-url";
import type { AchievementTier } from "@/lib/achievements";

interface TeamRow {
  id: string;
  name: string;
  xp: number;
  rank: number;
  movement: number;
  isMe: boolean;
  ownerName: string;
  equippedBadgeUrl: string | null;
  equippedBannerUrl: string | null;
  equippedAchievementName: string | null;
  equippedAchievementTier: AchievementTier | null;
}

interface RiderRow {
  id: string;
  fullName: string;
  nationality: string | null;
  photoUrl: string | null;
  pcsRank: number | null;
  xp: number;
  movement: number;
  ownerName: string | null;
  teamId: string | null;
  isMyRider: boolean;
  isFormer: boolean;
}

interface Race {
  slug: string;
  name: string;
  childSlugs: string[];
}

interface ArchivedPlayer {
  key: string;
  displayName: string;
  isFormerPlayer: boolean;
}

interface ArchivedSeason {
  year: number;
  /** Already sorted, rank 1 first. */
  ranking: ArchivedPlayer[];
}

interface RankingClientProps {
  leagueId: string;
  teams: TeamRow[];
  riders: RiderRow[];
  races: Race[];
  initialRace?: string | null;
  teamXpByRace: Record<string, Record<string, number>>;
  riderXpByRace: Record<string, Record<string, number>>;
  currentSeason: number;
  archivedSeasons: ArchivedSeason[];
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function RankingClient({
  leagueId,
  teams,
  riders,
  races,
  teamXpByRace,
  riderXpByRace,
  initialRace,
  currentSeason,
  archivedSeasons,
}: RankingClientProps) {
  const [tabIndex, setTabIndex] = useState(0);
  const [selectedRace, setSelectedRace] = useState<string | null>(initialRace ?? null);
  const [selectedSeason, setSelectedSeason] = useState<number>(currentSeason);

  // A season played before WattHunter has a standing per player and no rider
  // data at all: there were no riders to own.
  const archived = archivedSeasons.find((season) => season.year === selectedSeason) ?? null;
  const seasonOptions = [
    currentSeason,
    ...archivedSeasons.map((s) => s.year).filter((year) => year !== currentSeason),
  ].sort((a, b) => b - a);

  const isAllRaces = selectedRace === null;

  // Resolve child slugs for the selected race (handles grouped stages)
  const selectedChildSlugs = selectedRace
    ? races.find((r) => r.slug === selectedRace)?.childSlugs ?? [selectedRace]
    : [];

  // Sum XP across all child slugs for a given entity map
  function sumXpAcrossSlugs(
    xpByRace: Record<string, Record<string, number>>,
    entityId: string,
  ): number {
    let total = 0;
    for (const slug of selectedChildSlugs) {
      total += xpByRace[slug]?.[entityId] ?? 0;
    }
    return total;
  }

  // Re-rank teams when filtering by single race
  const rankedTeams = (() => {
    if (isAllRaces) return teams;
    return teams
      .map((t) => ({ ...t, xp: sumXpAcrossSlugs(teamXpByRace, t.id) }))
      .sort((a, b) => b.xp - a.xp)
      .map((t, i) => ({ ...t, rank: i + 1 }));
  })();

  // Re-rank riders when filtering by single race
  const rankedRiders = (() => {
    if (isAllRaces) return riders;
    return riders
      .map((r) => ({ ...r, xp: sumXpAcrossSlugs(riderXpByRace, r.id) }))
      .sort((a, b) => b.xp - a.xp);
  })();

  return (
    <div className="space-y-4 pb-24">
      {/* Page title + season selector */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
          Ranking
        </h1>
        {seasonOptions.length > 1 && (
          <Select
            value={String(selectedSeason)}
            onValueChange={(v) => setSelectedSeason(Number(v))}
          >
            <SelectTrigger className="w-auto gap-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {seasonOptions.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tabs: Teams / Riders — disabled, not hidden, on a season with no rider
          data: hiding it would make the layout jump from one year to the next. */}
      <div className="px-4">
        <SegmentedControl
          segments={["Teams", "Riders"]}
          activeIndex={tabIndex}
          onChange={setTabIndex}
          disabled={archived !== null}
        />
      </div>

      {archived && (
        <div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {archived.ranking.map((player, i) => (
              <div key={player.key} className="flex items-center gap-3 px-4 py-3">
                {/* DS-EXCEPTION: w-[22px] — same rank column as the live ranking */}
                <span className="w-[22px] shrink-0 text-center font-mono text-[length:var(--type-emphasis)] font-bold tabular-nums text-[var(--text-mid)]">
                  {i + 1}
                </span>
                <span
                  className={`flex-1 truncate text-[length:var(--type-emphasis)] text-[var(--text-high)] ${
                    player.isFormerPlayer ? "italic font-normal" : "font-semibold"
                  }`}
                >
                  {player.displayName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Race filter */}
      {!archived && (
      <div className="px-4">
        <Select
          value={selectedRace ?? "all"}
          onValueChange={(v) => setSelectedRace(v === "all" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All races" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All races</SelectItem>
            {races.map((r) => (
              <SelectItem key={r.slug} value={r.slug}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      )}

      {/* Teams tab */}
      {!archived && tabIndex === 0 && (
        <div>
          <div className="px-4 pb-2">
            <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
              {rankedTeams.length} TEAM{rankedTeams.length !== 1 ? "S" : ""}
            </span>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {rankedTeams.map((team) => (
              <Link
                key={team.id}
                href={`/league/${leagueId}/ranking/team/${team.id}`}
                className={`relative flex items-center gap-3 px-4 py-3 transition-colors overflow-hidden hover:bg-[var(--bg-surface-hover)] ${
                  team.isMe ? "bg-[var(--bg-surface-active)]" : ""
                }`}
              >
                {/* Banner background (Option B) */}
                {team.equippedBannerUrl && (
                  <>
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${team.equippedBannerUrl})`, opacity: 0.12 }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-app)] via-transparent to-[var(--bg-app)]" />
                  </>
                )}

                {/* Position */}
                {/* DS-EXCEPTION: w-[22px] — layout constraint for rank column; w-5=20px and w-6=24px both cause misalignment with 1-3 digit rank numbers */}
                <span className="relative w-[22px] shrink-0 text-center font-mono text-[length:var(--type-emphasis)] font-bold text-[var(--text-mid)]">
                  {team.rank}
                </span>

                {/* Badge (when equipped) or spacer */}
                {team.equippedBadgeUrl && team.equippedAchievementTier ? (
                  <div className="relative shrink-0">
                    <AchievementBadge
                      badgeUrl={team.equippedBadgeUrl}
                      tier={team.equippedAchievementTier}
                      size={36}
                      locked={false}
                    />
                  </div>
                ) : null}

                {/* Name/XP + equipped achievement */}
                <div className="relative flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)] truncate">
                        {team.name}
                      </span>
                      {isAllRaces && <MovementTag movement={team.movement} />}
                    </div>
                    <div className="flex items-baseline gap-1 shrink-0">
                      <span className="font-mono text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">
                        {formatThousands(team.xp)}
                      </span>
                      <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">XP</span>
                    </div>
                  </div>
                  {team.equippedAchievementName && (
                    <div className="flex items-center justify-between">
                      <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
                        {team.equippedAchievementName}
                      </span>
                    </div>
                  )}
                </div>

                {/* Chevron */}
                <ChevronRight size={16} className="relative shrink-0 text-[var(--text-ghost)]" />
              </Link>
            ))}
          </div>

          {rankedTeams.length === 0 && (
            <p className="px-4 text-[length:var(--type-body)] text-[var(--text-mid)]">
              No teams in this league yet.
            </p>
          )}
        </div>
      )}

      {/* Riders tab */}
      {!archived && tabIndex === 1 && (
        <div>
          <div className="px-4 pb-2">
            <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
              {rankedRiders.length} RIDER{rankedRiders.length !== 1 ? "S" : ""} TOTAL
            </span>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {rankedRiders.map((rider, i) => {
              const isFree = !rider.ownerName;
              return (
                <Link
                  key={rider.id}
                  href={`/league/${leagueId}/rider/${rider.id}?from=ranking`}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-surface-hover)] ${
                    isFree ? "opacity-60" : ""
                  }`}
                >
                  {/* Position */}
                  {/* DS-EXCEPTION: w-[22px] — layout constraint for rank column (see teams tab) */}
                  <span className="w-[22px] shrink-0 text-center font-mono text-[length:var(--type-emphasis)] font-bold text-[var(--text-mid)]">
                    {i + 1}
                  </span>

                  {/* Avatar */}
                  <Avatar className={`size-9 shrink-0 ${rider.isMyRider ? "ring-1 ring-[var(--accent-default)]" : ""}`}>
                    {rider.photoUrl && (
                      <AvatarImage
                        src={resolvePhotoUrl(rider.photoUrl)}
                        alt={rider.fullName}
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <AvatarFallback className="bg-[var(--bg-surface)] border border-[var(--border-default)] text-[length:var(--type-micro)] text-[var(--text-mid)]">
                      {getInitials(rider.fullName)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name + owner */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)] truncate">
                        {rider.fullName}
                      </span>
                      {rider.nationality && (
                        <span className="shrink-0 text-[length:var(--type-caption)]">
                          {countryCodeToFlag(rider.nationality)}
                        </span>
                      )}
                      {isAllRaces && <MovementTag movement={rider.movement} />}
                    </div>
                    <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
                      {rider.ownerName ? `@${rider.ownerName}` : rider.isFormer ? "Free agent" : "Not recruited"}
                    </span>
                  </div>

                  {/* XP */}
                  <div className="flex items-baseline gap-1 shrink-0">
                    <span className="font-mono text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">
                      {formatThousands(rider.xp)}
                    </span>
                    <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">
                      XP
                    </span>
                  </div>

                  {/* Chevron */}
                  <ChevronRight size={16} className="shrink-0 text-[var(--text-ghost)]" />
                </Link>
              );
            })}
          </div>

          {rankedRiders.length === 0 && (
            <p className="px-4 text-[length:var(--type-body)] text-[var(--text-mid)]">
              No riders recruited in this league yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
