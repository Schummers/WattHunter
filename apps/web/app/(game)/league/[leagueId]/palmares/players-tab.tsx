"use client";

import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  computeCareer,
  computeHeadToHead,
  computeSeasonRanks,
  computeWins,
} from "@/lib/palmares/aggregate";
import { formatHeadToHeadScore } from "@/lib/palmares/format";
import type { PalmaresData } from "@/lib/palmares/load";

/** Bar height: the rank against the size of the field. 1st fills the bar. */
function barHeight(rank: number, fieldSize: number): number {
  if (fieldSize <= 0) return 0;
  return ((fieldSize - rank + 1) / fieldSize) * 100;
}

function CareerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border-subtle)] py-2">
      <span className="text-[length:var(--type-body)] text-[var(--text-mid)]">{label}</span>
      <span className="font-mono text-[length:var(--type-emphasis)] font-semibold tabular-nums text-[var(--text-high)]">
        {value}
      </span>
    </div>
  );
}

export function PlayersTab({ data }: { data: PalmaresData }) {
  const { events, standings, viewerKey } = data;

  const players = useMemo(
    () => computeWins(events).slice().sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [events],
  );

  const [selectedKey, setSelectedKey] = useState<string>(
    () => (viewerKey && players.some((p) => p.key === viewerKey) ? viewerKey : players[0]?.key) ?? "",
  );

  const career = useMemo(
    () => computeCareer(events, standings, selectedKey),
    [events, standings, selectedKey],
  );
  const seasonRanks = useMemo(
    () => computeSeasonRanks(standings, selectedKey),
    [standings, selectedKey],
  );
  const headToHead = useMemo(
    () => computeHeadToHead(events, selectedKey),
    [events, selectedKey],
  );

  if (players.length === 0 || !career) {
    return (
      <p className="px-4 text-[length:var(--type-body)] text-[var(--text-mid)]">
        No player has raced yet.
      </p>
    );
  }

  return (
    <div className="space-y-6 px-4">
      <Select value={selectedKey} onValueChange={setSelectedKey}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {players.map((player) => (
            <SelectItem key={player.key} value={player.key}>
              {player.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div>
        <CareerRow label="Starts" value={`${career.starts} / ${career.totalEvents}`} />
        <CareerRow
          label="Seasons played"
          value={`${career.seasonsPlayed} / ${career.totalSeasons}`}
        />
        <CareerRow label="Wins" value={String(career.wins)} />
        <CareerRow label="Season titles" value={String(career.seasonTitles)} />
        <CareerRow label="Podiums" value={career.podium.join(" · ")} />
        <CareerRow label="Jerseys" value={String(career.jerseys)} />
      </div>

      <div>
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          My rank in each season
        </span>

        <div className="mt-3 flex h-24 items-end gap-1 overflow-x-auto">
          {seasonRanks.map((season) => {
            const isWin = season.rank === 1;
            return (
              <div
                key={season.seasonYear}
                className="flex h-full min-w-6 flex-1 flex-col justify-end gap-1"
              >
                {/* The number is always written: a height alone does not say
                    whether "high" means 2nd of 5 or 2nd of 10. */}
                <span
                  className={`text-center font-mono text-[length:var(--type-micro)] font-semibold tabular-nums ${
                    isWin ? "text-[var(--text-high)]" : "text-[var(--text-mid)]"
                  }`}
                >
                  {season.rank}
                </span>
                <div
                  className={`w-full rounded-sm border ${
                    isWin
                      ? "border-[var(--accent-default)] bg-[var(--accent-default)]"
                      : "border-[var(--border-default)] bg-[var(--bg-surface-hover)]"
                  }`}
                  style={{ height: `${barHeight(season.rank, season.fieldSize)}%` }}
                />
                <span className="text-center font-mono text-[length:var(--type-micro)] tabular-nums text-[var(--text-ghost)]">
                  {season.seasonYear}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-[length:var(--type-caption)] text-[var(--text-low)]">
          <span className="font-semibold text-[var(--text-mid)]">The number is your rank</span>{" "}
          in the season standings, the bar shows it against the number of players. Never a
          score: the scale has changed several times, only ranks compare across years.
        </p>
      </div>

      <div>
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          Head to head
        </span>

        <div className="mt-3 space-y-1.5">
          {headToHead.map((opponent) => {
            const share = opponent.shared === 0 ? 0 : (opponent.ahead / opponent.shared) * 100;
            const outcome =
              opponent.ahead > opponent.behind
                ? "up"
                : opponent.ahead < opponent.behind
                  ? "down"
                  : "even";
            const barColor =
              outcome === "up"
                ? "var(--success)"
                : outcome === "down"
                  ? "var(--danger)"
                  : "var(--text-ghost)";
            const scoreColor =
              outcome === "up"
                ? "text-[var(--success)]"
                : outcome === "down"
                  ? "text-[var(--danger)]"
                  : "text-[var(--text-mid)]";

            return (
              <div
                key={opponent.key}
                className="grid grid-cols-[1fr_4rem_2.5rem] items-center gap-2"
              >
                <span
                  className={`truncate text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)] ${
                    opponent.isFormerPlayer ? "italic font-normal" : ""
                  }`}
                >
                  {opponent.displayName}
                </span>

                <div className="relative h-2 rounded-sm border border-[var(--border-default)] bg-[var(--bg-surface-hover)]">
                  <div
                    className="h-full rounded-l-sm"
                    style={{ width: `${share}%`, backgroundColor: barColor }}
                  />
                  {/* Even mark: half the shared races is the line that decides
                      whether the bar reads as domination or not. */}
                  <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--border-hover)]" />
                </div>

                <span
                  className={`text-right font-mono text-[length:var(--type-caption)] font-semibold tabular-nums ${scoreColor}`}
                >
                  {formatHeadToHeadScore(opponent.ahead, opponent.behind)}
                </span>
              </div>
            );
          })}
        </div>

        {headToHead.length === 0 && (
          <p className="mt-3 text-[length:var(--type-body)] text-[var(--text-mid)]">
            No shared race yet.
          </p>
        )}

        <p className="mt-3 text-[length:var(--type-caption)] text-[var(--text-low)]">
          <span className="font-semibold text-[var(--text-mid)]">Head to head</span>: across the
          races you both entered, how often you finished ahead. Against an opponent who raced 24
          of your races you can win 16; against one who raced only 22, the two he missed do not
          count.{" "}
          <span className="font-semibold text-[var(--text-mid)]">
            Ranks compared, never points
          </span>
          , which is what makes it valid across both games.
        </p>
      </div>
    </div>
  );
}
