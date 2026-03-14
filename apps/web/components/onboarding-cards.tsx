"use client";

import { useState, useEffect } from "react";
import { InfoCard } from "@/components/info-card";
import {
  Users,
  TrendingUp,
  Gem,
  Wallet,
  Layers,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface OnboardingCard {
  title: string;
  description: string;
  icon: LucideIcon;
  anchor: string;
}

const CARDS: OnboardingCard[] = [
  {
    title: "Build your team",
    description: "Bid on riders at auction — your bid becomes their monthly salary",
    icon: Users,
    anchor: "auctions",
  },
  {
    title: "Earn XP from races",
    description: "Real PCS points convert to game XP daily — climb the ranking",
    icon: TrendingUp,
    anchor: "scoring-xp",
  },
  {
    title: "Hunt hidden gems",
    description: "Low-salary riders generate bonuses when they perform",
    icon: Gem,
    anchor: "salary-bonus",
  },
  {
    title: "Manage your budget",
    description: "Start with 200k + earn 200k/month from your sponsor",
    icon: Wallet,
    anchor: "budget",
  },
  {
    title: "Level up",
    description: "XP unlocks more roster slots, policies, and elite riders",
    icon: Layers,
    anchor: "levels",
  },
];

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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          Getting Started
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

      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <InfoCard
            key={card.anchor}
            href={`/league/${leagueId}/help#${card.anchor}`}
            className="p-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)]">
                <Icon size={18} className="text-[var(--accent-default)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                  {card.title}
                </p>
                <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
                  {card.description}
                </p>
              </div>
            </div>
          </InfoCard>
        );
      })}
    </div>
  );
}
