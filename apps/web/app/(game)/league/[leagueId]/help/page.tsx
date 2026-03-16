"use client";

import { BackHeader } from "@/components/back-header";
import { GameGuideAccordion } from "@/components/game-guide-accordion";

export default function HelpPage() {
  return (
    <div className="min-h-screen">
      <BackHeader label="Back" />

      <div className="px-4 pt-4 pb-24">
        <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)] mb-4">
          Game Guide
        </h1>
        <GameGuideAccordion />
      </div>
    </div>
  );
}
