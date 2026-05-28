"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getLevelByNumber } from "@/lib/levels";
import type { LobbyRider } from "../lobby-panels";

export interface RiderPoolListProps {
  leagueId: string;
  level: number;
  riders: LobbyRider[];
}

export function RiderPoolList({ leagueId, level, riders }: RiderPoolListProps) {
  const { poolMin } = getLevelByNumber(level);
  const visible = useMemo(
    () => riders.filter((r) => r.pcs_rank >= poolMin && r.pcs_rank <= 600),
    [riders, poolMin]
  );

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          Rider pool
        </h2>
        <span className="font-mono text-[length:var(--type-caption)] text-[var(--text-low)]">
          #{poolMin}–#600 · {visible.length} riders
        </span>
      </header>
      <ul className="flex max-h-[60svh] flex-col overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        {visible.map((rider) => (
          <li key={rider.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
            <Link
              href={`/league/${leagueId}/rider/${rider.id}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] hover:bg-[var(--bg-surface-hover)]"
            >
              <span className="w-10 shrink-0 font-mono text-[length:var(--type-caption)] text-[var(--text-low)]">
                #{rider.pcs_rank}
              </span>
              <span className="flex-1 truncate text-[length:var(--type-body)] text-[var(--text-high)]">
                {rider.full_name}
              </span>
              <span className="shrink-0 font-mono text-[length:var(--type-caption)] text-[var(--text-mid)]">
                {rider.pcs_points_1yr.toLocaleString("en-US")} pts
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
