"use client";

interface PillProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function Pill({ label, active, onClick }: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-[var(--text-high)] text-[var(--bg-app)]"
          : "border border-[var(--border-default)] text-[var(--text-mid)] hover:bg-[var(--bg-subtle)] hover:border-[var(--border-hover)]"
      }`}
    >
      {label}
    </button>
  );
}
