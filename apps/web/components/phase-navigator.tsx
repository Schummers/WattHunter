"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { AUCTION_PHASES, formatPhaseRange } from "@/lib/phases";

interface PhaseNavigatorProps {
  currentIndex: number;
  onChange: (index: number) => void;
}

export function PhaseNavigator({ currentIndex, onChange }: PhaseNavigatorProps) {
  const phase = AUCTION_PHASES[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === AUCTION_PHASES.length - 1;

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <button
        onClick={() => onChange(currentIndex - 1)}
        disabled={isFirst}
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] text-[var(--text-mid)] transition-colors hover:bg-[var(--bg-surface-hover)] disabled:opacity-[0.35] disabled:pointer-events-none"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="text-center">
        <div className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          {phase.label}
        </div>
        <div className="text-[length:var(--type-caption)] font-medium text-[var(--text-low)]">
          {formatPhaseRange(phase)}
        </div>
      </div>

      <button
        onClick={() => onChange(currentIndex + 1)}
        disabled={isLast}
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] text-[var(--text-mid)] transition-colors hover:bg-[var(--bg-surface-hover)] disabled:opacity-[0.35] disabled:pointer-events-none"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
