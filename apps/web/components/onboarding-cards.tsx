"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { GameGuideAccordion } from "@/components/game-guide-accordion";

function getStorageKey(leagueId: string) {
  return `wh-onboarding-dismissed-${leagueId}`;
}

interface OnboardingCardsProps {
  leagueId: string;
}

export function OnboardingCards({ leagueId }: OnboardingCardsProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(getStorageKey(leagueId));
    setDismissed(stored === "true");
  }, [leagueId]);

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(getStorageKey(leagueId), "true");
    setDismissed(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          Game Guide
        </span>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex items-center gap-1 text-[length:var(--type-caption)] text-[var(--text-low)] hover:text-[var(--text-mid)] transition-colors"
        >
          <X size={14} />
          Got it
        </button>
      </div>
      <GameGuideAccordion />
    </div>
  );
}
