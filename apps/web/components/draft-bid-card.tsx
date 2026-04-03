"use client";

import { useState, useTransition } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MovementTag } from "@/components/movement-tag";
import { countryCodeToFlag, formatThousands } from "@/lib/format";

interface DraftBidCardProps {
  rider: {
    id: string;
    name: string;
    nationality?: string;
    team_name?: string;
    pcs_rank?: number;
    pcs_rank_prev?: number;
    specialty?: string;
    photo_url?: string | null;
  };
  amount: number;
  minSalary: number;
  boostPct?: number;
  onRemove: () => void;
  onAmountChange: (newAmount: number) => void;
  onNavigate: () => void;
}

const INCREMENT = 500;

function resolvePhotoUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `https://www.procyclingstats.com/${url}`;
}

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getRankMovement(rank?: number, rankPrev?: number): number | null {
  if (rank == null || rankPrev == null) return null;
  // Positive = moved up (rank number decreased), negative = moved down
  return rankPrev - rank;
}

export function DraftBidCard({
  rider,
  amount,
  minSalary,
  boostPct,
  onRemove,
  onAmountChange,
  onNavigate,
}: DraftBidCardProps) {
  const [localAmount, setLocalAmount] = useState(amount);
  const [, startTransition] = useTransition();

  const flag = rider.nationality ? countryCodeToFlag(rider.nationality) : null;
  const movement = getRankMovement(rider.pcs_rank, rider.pcs_rank_prev);

  function handleDecrement() {
    const next = Math.max(minSalary, localAmount - INCREMENT);
    if (next === localAmount) return;
    setLocalAmount(next);
    startTransition(() => {
      onAmountChange(next);
    });
  }

  function handleIncrement() {
    const next = localAmount + INCREMENT;
    setLocalAmount(next);
    startTransition(() => {
      onAmountChange(next);
    });
  }

  const canDecrement = localAmount > minSalary;

  return (
    <div className="relative px-4 py-4 after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-[var(--border-default)]">
      {/* Top row: avatar + info + trash */}
      <div className="flex items-center gap-[10px]">
        {/* Avatar with PCS badge */}
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            {rider.photo_url && (
              <AvatarImage
                src={resolvePhotoUrl(rider.photo_url)}
                alt={rider.name}
                referrerPolicy="no-referrer"
              />
            )}
            <AvatarFallback className="bg-[var(--bg-surface-active)] text-[length:var(--type-micro)] text-[var(--text-low)]">
              {getInitials(rider.name)}
            </AvatarFallback>
          </Avatar>
          {rider.pcs_rank != null && (
            <span className="absolute -bottom-0.5 -right-0.5 rounded bg-[var(--bg-surface-active)] border border-[var(--border-default)] px-[3px] py-px font-mono text-[length:var(--type-micro)] leading-none text-[var(--text-mid)]">
              #{rider.pcs_rank}
            </span>
          )}
        </div>

        {/* Rider info */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Line 1: name + chevron + flag + rank movement + boost */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={onNavigate}
              className="text-[length:var(--type-emphasis)] font-medium text-[var(--text-high)] hover:text-[var(--accent-default)] transition-colors truncate"
            >
              {rider.name}
            </button>
            <ChevronRight
              size={12}
              className="shrink-0 text-[var(--text-ghost)]"
            />
            {flag && (
              <span className="shrink-0 text-[length:var(--type-caption)]">
                {flag}
              </span>
            )}
            {movement !== null && <MovementTag movement={movement} />}
            {boostPct != null && boostPct > 0 && (
              <span className="shrink-0 rounded-[var(--radius-pill)] bg-[var(--badge-bg)] px-[5px] py-px font-mono text-[length:var(--type-micro)] font-semibold text-[var(--accent-highlight)]">
                +{boostPct}%
              </span>
            )}
          </div>
          {/* Line 2: team · specialty */}
          <div className="mt-px flex items-center gap-1.5 text-[length:var(--type-caption)] text-[var(--text-low)]">
            {rider.team_name && (
              <span className="truncate">{rider.team_name}</span>
            )}
            {rider.team_name && rider.specialty && (
              <span className="text-[var(--text-ghost)]">·</span>
            )}
            {rider.specialty && (
              <span className="shrink-0 text-[var(--text-mid)]">
                {rider.specialty}
              </span>
            )}
          </div>
        </div>

        {/* Trash button */}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove bid"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-red-500/[0.12] text-red-400 transition-colors hover:bg-red-500/20"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Bid row: [−] [input] [+] */}
      <div className="mt-3 flex items-start gap-3">
        {/* Minus */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={!canDecrement}
          aria-label="Decrease bid"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface-active)] text-lg transition-colors ${
            canDecrement
              ? "text-[var(--text-mid)] hover:border-[var(--border-hover)] hover:text-[var(--text-high)]"
              : "cursor-not-allowed text-[var(--text-ghost)]"
          }`}
        >
          −
        </button>

        {/* Input column */}
        <div className="flex flex-1 flex-col items-center">
          <input
            type="text"
            readOnly
            value={`€${formatThousands(localAmount)}`}
            autoComplete="off"
            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-[10px] py-[9px] text-center font-mono text-[length:var(--type-emphasis)] text-[var(--text-high)]"
          />
          <span className="mt-[3px] text-[length:var(--type-micro)] text-[var(--text-low)]">
            Min: <span className="font-mono">€{formatThousands(minSalary)}</span>
          </span>
        </div>

        {/* Plus */}
        <button
          type="button"
          onClick={handleIncrement}
          aria-label="Increase bid"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface-active)] text-lg text-[var(--text-mid)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-high)]"
        >
          +
        </button>
      </div>
    </div>
  );
}
