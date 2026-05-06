"use client";

import { useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MovementTag } from "@/components/movement-tag";
import { countryCodeToFlag, formatThousands } from "@/lib/format";
import { BID_INCREMENT } from "@/lib/budget";
import { resolvePhotoUrl } from "@/lib/photo-url";

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
  /** Called in real-time while typing — updates parent budget preview (no server action). */
  onAmountChange: (newAmount: number) => void;
  /** Called on blur and +/− clicks — saves to DB (triggers server action). */
  onAmountSave: (newAmount: number) => void;
  onNavigate: () => void;
}

const INCREMENT = BID_INCREMENT;

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

function snapToIncrement(value: number, min: number): number {
  return Math.max(min, Math.round(value / 100) * 100);
}

export function DraftBidCard({
  rider,
  amount,
  minSalary,
  boostPct,
  onRemove,
  onAmountChange,
  onAmountSave,
  onNavigate,
}: DraftBidCardProps) {
  const [localAmount, setLocalAmount] = useState(amount);
  const [inputValue, setInputValue] = useState(String(amount));
  const flag = rider.nationality ? countryCodeToFlag(rider.nationality) : null;
  const movement = getRankMovement(rider.pcs_rank, rider.pcs_rank_prev);

  function commitAmount(next: number) {
    setLocalAmount(next);
    setInputValue(String(next));
    onAmountChange(next);
  }

  function handleDecrement() {
    const next = snapToIncrement(localAmount - INCREMENT, minSalary);
    if (next === localAmount) return;
    commitAmount(next);
    onAmountSave(next);
  }

  function handleIncrement() {
    const next = snapToIncrement(localAmount + INCREMENT, minSalary);
    commitAmount(next);
    onAmountSave(next);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "");
    setInputValue(raw);
    // Real-time budget preview: update localAmount and propagate to parent without saving
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      const next = snapToIncrement(parsed, minSalary);
      setLocalAmount(next);
      onAmountChange(next);
    }
  }

  function handleInputBlur() {
    const parsed = parseInt(inputValue, 10);
    const next = snapToIncrement(isNaN(parsed) ? minSalary : parsed, minSalary);
    setLocalAmount(next);
    setInputValue(String(next));
    onAmountChange(next);
    onAmountSave(next);
  }

  const canDecrement = localAmount > minSalary;

  return (
    <div className="relative px-4 py-4 after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-[var(--border-default)]">
      {/* Top row: avatar + info + trash */}
      <div className="flex items-center gap-[10px]">
        {/* Avatar with PCS badge */}
        <div className="relative shrink-0">
          <Avatar className="h-11 w-11">
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--danger-bg)] text-red-400 transition-colors hover:bg-[var(--danger-bg)]"
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
            inputMode="numeric"
            pattern="[0-9]*"
            value={inputValue === String(localAmount) ? `€${formatThousands(localAmount)}` : inputValue}
            onChange={handleInputChange}
            onFocus={() => setInputValue(String(localAmount))}
            onBlur={handleInputBlur}
            autoComplete="off"
            className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-[10px] py-[9px] text-center font-mono text-[length:var(--type-emphasis)] text-[var(--text-high)] focus:border-[var(--accent-default)] focus:outline-none"
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
