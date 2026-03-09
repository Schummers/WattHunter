"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface DetailRailProps {
  children: React.ReactNode;
  onClose: () => void;
}

export function DetailRail({ children, onClose }: DetailRailProps) {
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={railRef}
      className="hidden lg:flex lg:flex-col border-l border-[var(--border-default)] bg-[var(--bg-app)] overflow-y-auto animate-in slide-in-from-right duration-300"
      style={{ flex: "2", minWidth: "380px" }}
    >
      <div className="sticky top-0 z-10 flex items-center justify-end px-4 py-2 bg-[var(--bg-app)]">
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-lg text-[var(--text-mid)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-high)] transition-colors"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
