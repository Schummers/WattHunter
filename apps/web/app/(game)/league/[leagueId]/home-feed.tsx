"use client";

import Link from "next/link";
import { TeamLevelCard } from "@/components/team-level-card";
import { InfoCard } from "@/components/info-card";
import { Users, Wallet, Timer, ChevronRight, Trophy } from "lucide-react";

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
  teamName: string;
  treasury: number;
  xp: number;
  level: number;
  rosterCount: number;
  maxSlots: number;
  activeAuction: ActiveAuction | null;
  memberCount: number;
}

export function HomeFeed({
  leagueId,
  teamName,
  treasury,
  xp,
  level,
  rosterCount,
  maxSlots,
  activeAuction,
  memberCount,
}: HomeFeedProps) {
  return (
    <div className="min-h-full">
      <div className="px-4 pt-4 space-y-3">
      {/* Team Overview */}
      <InfoCard className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            {teamName}
          </span>
          <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-low)]">
            {memberCount} players
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Treasury */}
          <div className="flex flex-col items-center gap-1 rounded-lg bg-[var(--bg-app)] px-2 py-2.5">
            <Wallet size={16} className="text-[var(--text-mid)]" />
            <span className="font-mono text-[length:var(--type-stat-small)] font-bold text-[var(--text-high)]">
              {(treasury / 1000).toFixed(0)}k
            </span>
            <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
              Treasury
            </span>
          </div>

          {/* Roster */}
          <Link
            href={`/league/${leagueId}/team`}
            className="flex flex-col items-center gap-1 rounded-lg bg-[var(--bg-app)] px-2 py-2.5 hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <Users size={16} className="text-[var(--text-mid)]" />
            <span className="font-mono text-[length:var(--type-stat-small)] font-bold text-[var(--text-high)]">
              {rosterCount}/{maxSlots}
            </span>
            <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
              Roster
            </span>
          </Link>

          {/* Ranking */}
          <div className="flex flex-col items-center gap-1 rounded-lg bg-[var(--bg-app)] px-2 py-2.5">
            <Trophy size={16} className="text-[var(--text-mid)]" />
            <span className="font-mono text-[length:var(--type-body)] font-bold text-[var(--text-low)]">
              --
            </span>
            <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
              Rank
            </span>
          </div>
        </div>
      </InfoCard>

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

      {/* Level Progress */}
      <TeamLevelCard
        leagueId={leagueId}
        currentLevel={level}
        currentXp={xp}
        teamName={teamName}
        variant="home"
      />

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
      </div>
    </div>
  );
}
