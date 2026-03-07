"use client";

import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Users, Wallet, Zap, Timer, ChevronRight, Trophy } from "lucide-react";

const LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1500, 2500, 4000, 6000, 9000];

function getProgressPct(xp: number, level: number): number {
  const currentXp = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextXp = level < 10 ? LEVEL_THRESHOLDS[level] : null;
  if (!nextXp) return 100;
  const range = nextXp - currentXp;
  if (range <= 0) return 100;
  return Math.min(100, Math.round(((xp - currentXp) / range) * 100));
}

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
  const progressPct = getProgressPct(xp, level);
  const nextXp = level < 10 ? LEVEL_THRESHOLDS[level] : null;

  return (
    <div className="pt-4 space-y-3">
      {/* Team Overview */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-[var(--text-high)]">
            {teamName}
          </span>
          <span className="text-xs font-medium text-[var(--text-low)]">
            {memberCount} players
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Treasury */}
          <div className="flex flex-col items-center gap-1 rounded-lg bg-[var(--bg-app)] px-2 py-2.5">
            <Wallet size={16} className="text-[var(--text-mid)]" />
            <span className="font-mono text-sm font-bold text-[var(--text-high)]">
              {(treasury / 1000).toFixed(0)}k
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-low)]">
              Treasury
            </span>
          </div>

          {/* Roster */}
          <Link
            href={`/league/${leagueId}/team`}
            className="flex flex-col items-center gap-1 rounded-lg bg-[var(--bg-app)] px-2 py-2.5 hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <Users size={16} className="text-[var(--text-mid)]" />
            <span className="font-mono text-sm font-bold text-[var(--text-high)]">
              {rosterCount}/{maxSlots}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-low)]">
              Roster
            </span>
          </Link>

          {/* Ranking */}
          <div className="flex flex-col items-center gap-1 rounded-lg bg-[var(--bg-app)] px-2 py-2.5">
            <Trophy size={16} className="text-[var(--text-mid)]" />
            <span className="font-mono text-sm font-bold text-[var(--text-low)]">
              --
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-low)]">
              Rank
            </span>
          </div>
        </div>
      </div>

      {/* Auction Card */}
      {activeAuction && (
        <Link
          href={
            activeAuction.status === "open"
              ? `/league/${leagueId}/team/recruts`
              : `/league/${leagueId}/team`
          }
          className="block rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-muted)]">
                <Timer size={18} className="text-[var(--accent-default)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-high)]">
                  {activeAuction.name}
                </p>
                <p className="text-xs text-[var(--text-mid)]">
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
        </Link>
      )}

      {/* Level Progress */}
      <Link
        href={`/league/${leagueId}/team/levels`}
        className="block rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-highlight)]">
              <span className="text-base font-black text-[var(--bg-app)]">
                {level}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text-high)]">
                  Level {level}
                </span>
                <Zap size={12} className="text-[var(--accent-default)]" />
                <span className="text-xs font-bold text-[var(--accent-default)]">
                  {xp.toLocaleString()} XP
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24">
                  <Progress value={progressPct} />
                </div>
                {nextXp && (
                  <span className="text-[10px] text-[var(--text-low)]">
                    {nextXp.toLocaleString()} XP
                  </span>
                )}
              </div>
            </div>
          </div>
          <ChevronRight size={16} className="shrink-0 text-[var(--text-ghost)]" />
        </div>
      </Link>

      {/* Open Slots CTA */}
      {rosterCount < maxSlots && activeAuction?.status === "open" && (
        <Link
          href={`/league/${leagueId}/team/recruts`}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--accent-default)] bg-[var(--accent-muted)] px-4 py-3 text-sm font-semibold text-[var(--accent-default)]"
        >
          <Users size={16} />
          {maxSlots - rosterCount} open slot{maxSlots - rosterCount > 1 ? "s" : ""} — Browse recruits
        </Link>
      )}
    </div>
  );
}
