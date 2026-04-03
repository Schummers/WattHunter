"use client";

import { useState, useEffect } from "react";
import { useScrollDirection } from "@/hooks/use-scroll-direction";

interface StickyBarProps {
  saveEnabled: boolean;
  onSave: () => void;
  saving?: boolean;
  slotInfo?: string;
  budgetInfo?: string;
  children?: React.ReactNode;
  isDeficit?: boolean;
  deficitMessage?: string;
  warningMessage?: string;
  buttonLabel?: string;
  alwaysShow?: boolean;
}

export function StickyBar({
  saveEnabled,
  onSave,
  saving,
  slotInfo,
  budgetInfo,
  children,
  isDeficit,
  deficitMessage,
  warningMessage,
  buttonLabel,
  alwaysShow,
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
      className={`fixed inset-x-0 z-30 border-t border-[var(--border-default)] bg-[var(--bg-subtle)] py-2 transition-[bottom] duration-200${alwaysShow ? " lg:left-[180px] lg:bottom-0" : " lg:hidden"}`}
      style={bottomStyle}
    >
      {children ? (
        <div className="px-4">{children}</div>
      ) : (
        <div className="space-y-1 px-4">
          <div className="flex items-center justify-between">
            <span className={`text-[length:var(--type-emphasis)] font-semibold ${isDeficit ? "text-red-400" : "text-[var(--text-high)]"}`}>
              {slotInfo && <span className="font-mono">{slotInfo}</span>}
              {slotInfo && budgetInfo && " · "}
              {budgetInfo && <span className="font-mono">{budgetInfo}</span>}
            </span>
            <button
              onClick={onSave}
              disabled={!saveEnabled || saving || isDeficit}
              className={`rounded-lg px-4 py-1.5 text-[length:var(--type-emphasis)] font-semibold ${
                isDeficit
                  ? "bg-[var(--bg-surface)] text-[var(--text-low)] cursor-not-allowed"
                  : "cta-gradient text-[var(--cta-text)] disabled:opacity-40"
              }`}
            >
              {saving ? "Saving..." : (buttonLabel ?? "Save")}
            </button>
          </div>
          {isDeficit && deficitMessage && (
            <p className="text-[length:var(--type-caption)] text-red-400">{deficitMessage}</p>
          )}
          {warningMessage && (
            <p className="text-[length:var(--type-caption)] text-[var(--text-high)]">{warningMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}
