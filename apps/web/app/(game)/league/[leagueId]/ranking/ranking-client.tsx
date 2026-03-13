"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SegmentedControl } from "@/components/segmented-control";
import { MovementTag } from "@/components/movement-tag";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatThousands, countryCodeToFlag } from "@/lib/format";

interface TeamRow {
  id: string;
  name: string;
  xp: number;
  level: number;
  rank: number;
  movement: number;
  isMe: boolean;
  ownerName: string;
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
}

interface Race {
  slug: string;
  name: string;
  date: string;
  childSlugs: string[];
}

interface RankingClientProps {
  leagueId: string;
  teams: TeamRow[];
  riders: RiderRow[];
  races: Race[];
  teamXpByRace: Record<string, Record<string, number>>;
  riderXpByRace: Record<string, Record<string, number>>;
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function resolvePhoto(url: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `https://www.procyclingstats.com/${url}`;
}

export function RankingClient({
  leagueId,
  teams,
  riders,
  races,
  teamXpByRace,
  riderXpByRace,
}: RankingClientProps) {
  const [tabIndex, setTabIndex] = useState(0);
  const [selectedRace, setSelectedRace] = useState<string | null>(null);

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
      {/* Page title */}
      <div className="px-4 pt-4">
        <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
          Ranking
        </h1>
      </div>

      {/* Tabs: Teams / Riders */}
      <div className="px-4">
        <SegmentedControl
          segments={["Teams", "Riders"]}
          activeIndex={tabIndex}
          onChange={setTabIndex}
        />
      </div>

      {/* Race filter */}
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

      {/* Teams tab */}
      {tabIndex === 0 && (
        <div>
          <div className="px-4 pb-2">
            <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
              {rankedTeams.length} TEAM{rankedTeams.length !== 1 ? "S" : ""}
            </span>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {rankedTeams.map((team, i) => (
              <Link
                key={team.id}
                href={`/league/${leagueId}/ranking/team/${team.id}`}
                className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-surface-hover)] ${
                  team.isMe ? "bg-[var(--bg-surface-active)]" : ""
                }`}
              >
                {/* Position */}
                <span className="w-[22px] shrink-0 text-center font-mono text-[length:var(--type-emphasis)] font-bold text-[var(--text-mid)]">
                  {i + 1}
                </span>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)] truncate">
                      {team.name}
                    </span>
                    {isAllRaces && <MovementTag movement={team.movement} />}
                  </div>
                  <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
                    Lv.{team.level}
                  </span>
                </div>

                {/* XP */}
                <div className="flex items-baseline gap-1 shrink-0">
                  <span className="font-mono text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">
                    {formatThousands(team.xp)}
                  </span>
                  <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">
                    XP
                  </span>
                </div>

                {/* Chevron */}
                <ChevronRight size={16} className="shrink-0 text-[var(--text-ghost)]" />
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
      {tabIndex === 1 && (
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
                  <span className="w-[22px] shrink-0 text-center font-mono text-[length:var(--type-emphasis)] font-bold text-[var(--text-mid)]">
                    {i + 1}
                  </span>

                  {/* Avatar */}
                  <Avatar className={`size-9 shrink-0 ${rider.isMyRider ? "ring-1 ring-[var(--accent-default)]" : ""}`}>
                    {rider.photoUrl && (
                      <AvatarImage
                        src={resolvePhoto(rider.photoUrl)}
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
                      {rider.ownerName ? `@${rider.ownerName}` : "Not recruited"}
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
