"use client";

import { useState, useEffect } from "react";
import { useScrollDirection } from "@/hooks/use-scroll-direction";

interface StickyBarProps {
  saveEnabled: boolean;
  slotInfo: string;
  budgetInfo: string;
  onSave: () => void;
  saving?: boolean;
}

export function StickyBar({
  saveEnabled,
  slotInfo,
  budgetInfo,
  onSave,
  saving,
}: StickyBarProps) {
  const navVisible = useScrollDirection();
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      const offset = window.innerHeight - vv.height;
      setKeyboardOffset(offset > 50 ? offset : 0);
    };
    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);
    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
    };
  }, []);

  const bottomStyle =
    keyboardOffset > 0
      ? { bottom: `${keyboardOffset}px` }
      : { bottom: navVisible ? "3.5rem" : "0" };

  return (
    <div
      className="fixed inset-x-0 z-30 border-t border-[var(--border-default)] bg-[var(--bg-subtle)] py-2 transition-[bottom] duration-200 lg:!bottom-0"
      style={bottomStyle}
    >
      <div className="flex items-center justify-between px-4 lg:mx-auto lg:max-w-2xl">
        <span className="font-mono text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          {slotInfo} &middot; {budgetInfo}
        </span>
        <button
          onClick={onSave}
          disabled={!saveEnabled || saving}
          className="rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-400 px-4 py-1.5 text-[length:var(--type-emphasis)] font-semibold text-[var(--cta-text)] disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
