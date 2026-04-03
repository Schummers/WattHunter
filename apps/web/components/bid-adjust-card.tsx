"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Minus, Plus, ChevronRight } from "lucide-react";
import { RailLink } from "@/components/rail-link";
import { countryCodeToFlag, formatThousands } from "@/lib/format";

interface BidAdjustCardProps {
  rider: {
    id: string;
    full_name: string;
    nationality: string | null;
    real_team: string | null;
    specialty: string | null;
    pcs_rank: number | null;
    pcs_rank_diff: number | null;
    photo_url: string | null;
    pcs_points_1yr: number | null;
  };
  bidAmount: number;
  minSalary: number;
  onBidChange: (riderId: string, amount: number) => void;
  hasUnsavedChanges: boolean;
  leagueId: string;
}

function formatName(fullName: string): string {
  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length <= 1) return fullName;
  const lastName = parts[parts.length - 1];
  const firstInitial = parts[0][0].toUpperCase();
  return `${firstInitial}. ${lastName}`;
}

const STEP = 100;

export function BidAdjustCard({
  rider,
  bidAmount,
  minSalary,
  onBidChange,
  hasUnsavedChanges,
  leagueId,
}: BidAdjustCardProps) {
  const [inputValue, setInputValue] = useState(formatThousands(bidAmount));
  const inputRef = useRef<HTMLInputElement>(null);

  const flag = rider.nationality ? countryCodeToFlag(rider.nationality) : null;
  const isModified = hasUnsavedChanges;

  function handleDecrement() {
    const next = Math.max(minSalary, bidAmount - STEP);
    onBidChange(rider.id, next);
    setInputValue(formatThousands(next));
  }

  function handleIncrement() {
    const next = bidAmount + STEP;
    onBidChange(rider.id, next);
    setInputValue(formatThousands(next));
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
  }

  function handleInputBlur() {
    const raw = inputValue.replace(/\s/g, "");
    const val = parseInt(raw, 10);
    if (isNaN(val) || val < minSalary) {
      onBidChange(rider.id, minSalary);
      setInputValue(formatThousands(minSalary));
    } else {
      // Round to nearest 100
      const rounded = Math.round(val / 100) * 100;
      onBidChange(rider.id, rounded);
      setInputValue(formatThousands(rounded));
    }
  }

  const canDecrement = bidAmount > minSalary;

  return (
    <div
      className={`relative flex items-center gap-3 p-4 transition-colors hover:bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] ${
        isModified ? "shadow-[inset_2px_0_0_var(--accent-default)]" : ""
      }`}
    >
      {/* Avatar 48px */}
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[var(--bg-surface-active)]">
        {rider.photo_url ? (
          <Image
            src={rider.photo_url}
            alt={rider.full_name}
            fill
            className="object-cover object-top"
            sizes="48px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-[var(--text-mid)]">
            {rider.full_name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
        )}
      </div>

      {/* Rider info + stepper */}
      <div className="flex flex-1 min-w-0 flex-col gap-1.5">
        {/* Row 1: name + rank */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
            {formatName(rider.full_name)}
          </span>
          {flag && (
            <span className="shrink-0 text-[14px]">{flag}</span>
          )}
          {rider.pcs_rank != null && (
            <span className="shrink-0 font-mono text-[length:var(--type-caption)] text-[var(--text-low)]">
              #{rider.pcs_rank}
            </span>
          )}
        </div>

        {/* Row 2: team · specialty */}
        <div className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)] truncate">
          {[rider.real_team, rider.specialty].filter(Boolean).join(" · ")}
        </div>

        {/* Row 3: stepper */}
        <div className="flex items-center gap-2">
          {/* Decrement */}
          <button
            type="button"
            onClick={handleDecrement}
            disabled={!canDecrement}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-mid)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-high)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Minus size={12} />
          </button>

          {/* Input */}
          <div
            className={`flex items-center gap-1 rounded-md border px-2 h-7 ${
              isModified
                ? "border-[var(--accent-default)] bg-[var(--bg-surface-hover)]"
                : "border-[var(--border-default)] bg-transparent"
            }`}
          >
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              className={`w-20 bg-transparent text-center text-[length:var(--type-stat-small)] font-bold font-mono tabular-nums outline-none ${
                isModified
                  ? "text-[var(--accent-default)]"
                  : "text-[var(--text-high)]"
              }`}
            />
            <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-ghost)]">
              €
            </span>
          </div>

          {/* Increment */}
          <button
            type="button"
            onClick={handleIncrement}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-mid)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-high)]"
          >
            <Plus size={12} />
          </button>

          {/* Min salary hint */}
          <span className="text-[length:var(--type-micro)] text-[var(--text-ghost)]">
            min {formatThousands(minSalary)} €
          </span>
        </div>
      </div>

      {/* Chevron → rail link */}
      <RailLink
        href={`/league/${leagueId}/rider/${rider.id}?from=mybids`}
        className="shrink-0 p-1"
      >
        <ChevronRight size={16} className="text-[var(--text-ghost)]" />
      </RailLink>
    </div>
  );
}
