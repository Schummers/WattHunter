"use client";

import { useScrollDirection } from "@/hooks/use-scroll-direction";

interface StickyBarProps {
  visible: boolean;
  slotInfo: string;
  budgetInfo: string;
  onSave: () => void;
  saving?: boolean;
}

export function StickyBar({
  visible,
  slotInfo,
  budgetInfo,
  onSave,
  saving,
}: StickyBarProps) {
  const navVisible = useScrollDirection();

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-x-0 z-30 border-t border-[var(--border-default)] bg-[var(--bg-subtle)] py-2 transition-[bottom] duration-200 lg:bottom-0 ${
        navVisible ? "bottom-14" : "bottom-0"
      }`}
    >
      <div className="flex items-center justify-between px-4 lg:mx-auto lg:max-w-2xl">
        <span className="text-sm font-bold text-[var(--text-high)]">
          {slotInfo} &middot; {budgetInfo}
        </span>
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-400 px-4 py-1.5 text-sm font-bold text-[var(--cta-text)] shadow-[var(--cta-shadow)] disabled:opacity-40 disabled:shadow-none"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
