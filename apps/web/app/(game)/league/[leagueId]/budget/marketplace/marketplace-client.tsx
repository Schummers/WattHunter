"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackHeader } from "@/components/back-header";
import { StickyBar } from "@/components/sticky-bar";
import { cn } from "@/lib/utils";
import {
  formatBudget,
  thresholdLabel,
  expandNationality,
  type SponsorRow,
  type TeamSponsor,
} from "@/lib/sponsors";
import { saveSponsor } from "../actions";

interface MarketplaceClientProps {
  leagueId: string;
  teamId: string;
  teamLevel: number;
  sponsors: SponsorRow[];
  currentSponsor: TeamSponsor | null;
}

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

function BonusLine({
  label,
  threshold,
  bonus,
  suffix,
}: {
  label: string;
  threshold: number;
  bonus: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        {thresholdLabel(threshold)} — {label}
      </span>
      <span className="font-mono text-[length:var(--type-body)] font-medium text-[var(--text-high)] tabular-nums">
        +{formatBudget(bonus)}
        {suffix && (
          <span className="ml-1 text-[var(--text-low)]">{suffix}</span>
        )}
      </span>
    </div>
  );
}

function BonusDetails({ sponsor }: { sponsor: SponsorRow }) {
  const nationalities = expandNationality(sponsor.nationality);
  const nationalityFlag =
    nationalities.length > 0
      ? nationalities.map(countryFlag).join(" ")
      : null;

  const showMultipliers = !sponsor.has_explicit_prestige && (nationalityFlag || (sponsor.bonus_monument != null && sponsor.bonus_monument > sponsor.bonus_one_day));

  return (
    <div className="mt-1 mb-2 ml-10 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
      {/* Base Bonuses */}
      <div className="space-y-0.5">
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] block mb-2">Base Bonus</span>
        {sponsor.has_explicit_prestige ? (
          <>
            {sponsor.one_day_threshold != null && sponsor.bonus_one_day > 0 && <BonusLine label="One-Day" threshold={sponsor.one_day_threshold} bonus={sponsor.bonus_one_day} />}
            {sponsor.monument_threshold != null && sponsor.bonus_monument != null && sponsor.bonus_monument > 0 && <BonusLine label="Monument" threshold={sponsor.monument_threshold} bonus={sponsor.bonus_monument} />}
            {sponsor.gc_threshold != null && sponsor.bonus_gc > 0 && <BonusLine label="Stage Race GC" threshold={sponsor.gc_threshold} bonus={sponsor.bonus_gc} />}
            {sponsor.grand_tour_threshold != null && sponsor.bonus_grand_tour != null && sponsor.bonus_grand_tour > 0 && <BonusLine label="Grand Tour GC" threshold={sponsor.grand_tour_threshold} bonus={sponsor.bonus_grand_tour} />}
            {sponsor.stage_threshold != null && sponsor.bonus_stage > 0 && <BonusLine label="Stage" threshold={sponsor.stage_threshold} bonus={sponsor.bonus_stage} suffix="(×2 GT)" />}
          </>
        ) : (
          <>
            {sponsor.gc_threshold != null && sponsor.bonus_gc > 0 && <BonusLine label="GC" threshold={sponsor.gc_threshold} bonus={sponsor.bonus_gc} />}
            {sponsor.one_day_threshold != null && sponsor.bonus_one_day > 0 && <BonusLine label="One-Day" threshold={sponsor.one_day_threshold} bonus={sponsor.bonus_one_day} />}
            {sponsor.stage_threshold != null && sponsor.bonus_stage > 0 && <BonusLine label="Stage" threshold={sponsor.stage_threshold} bonus={sponsor.bonus_stage} />}
          </>
        )}
      </div>

      {/* Multipliers */}
      {showMultipliers && (
        <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] block mb-2">Multipliers</span>
          <ul className="space-y-2 text-[length:var(--type-body)] text-[var(--text-mid)]">
            {nationalityFlag && (
              <li className="flex items-center gap-2">
                <span className="font-mono font-bold text-[var(--text-high)] px-1.5 py-0.5 rounded bg-[var(--bg-app)] border border-[var(--border-default)]">×1.5</span> 
                <span>for riders {nationalityFlag}</span>
              </li>
            )}
            {sponsor.bonus_monument != null && sponsor.bonus_monument > sponsor.bonus_one_day && (
              <li className="flex items-center gap-2">
                <span className="font-mono font-bold text-[var(--text-high)] px-1.5 py-0.5 rounded bg-[var(--bg-app)] border border-[var(--border-default)]">×2</span> 
                <span>for Monuments and Grand Tours</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function SponsorListItem({
  sponsor,
  teamLevel,
  isSelected,
  isCurrent,
  onSelect,
}: {
  sponsor: SponsorRow;
  teamLevel: number;
  isSelected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLocked = teamLevel < sponsor.unlock_level;

  return (
    <div className={cn("border-b border-[var(--border-subtle)] pb-3", isLocked && "opacity-50")}>
      {/* Main row — clickable to select */}
      <div className="flex flex-col">
        <button
          type="button"
          disabled={isLocked}
          onClick={onSelect}
          className="flex w-full items-center justify-between py-3 text-left group"
        >
          {/* Left: Indicator, Name & Tags */}
          <div className="flex items-center gap-4 min-w-0 flex-1 pr-4">
            {/* Radio indicator */}
            <div
              className={cn(
                "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                isSelected
                  ? "border-[var(--accent-default)] bg-[var(--accent-default)]"
                  : "border-[var(--border-default)] bg-transparent group-hover:border-[var(--border-hover)]",
              )}
            >
              {isSelected && <Check size={14} strokeWidth={3} className="text-[var(--bg-app)]" />}
            </div>

            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)] whitespace-nowrap">
                {sponsor.name}
              </span>
              <span className="tag tag-default">Tier {sponsor.tier}</span>
              {isCurrent && <span className="tag tag-highlight">Current</span>}
            </div>
          </div>

          {/* Right: Budget or Lock */}
          <div className="flex items-center text-right shrink-0">
            {isLocked ? (
              <span className="tag tag-default"><Lock size={12}/> Lv.{sponsor.unlock_level}</span>
            ) : (
              <span className="font-mono text-[length:var(--type-stat-small)] font-bold text-[var(--text-high)] tabular-nums">
                {formatBudget(sponsor.monthly_budget)}
              </span>
            )}
          </div>
        </button>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "flex w-fit items-center gap-1.5 ml-9 rounded text-[length:var(--type-caption)] transition-colors",
            expanded ? "text-[var(--text-high)]" : "text-[var(--text-low)] hover:text-[var(--text-mid)]"
          )}
        >
          <ChevronRight
            size={14}
            className={cn("transition-transform duration-200", expanded && "rotate-90")}
          />
          View Bonus Objectives
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3">
          <BonusDetails sponsor={sponsor} />
        </div>
      )}
    </div>
  );
}

export function MarketplaceClient({
  leagueId,
  teamId,
  teamLevel,
  sponsors,
  currentSponsor,
}: MarketplaceClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const initialSponsorId = currentSponsor?.sponsor_id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(initialSponsorId);

  const hasChanges = selectedId !== initialSponsorId;

  // Flatten and sort simply by sort_order
  const sortedSponsors = [...sponsors].sort((a, b) => a.sort_order - b.sort_order);

  function handleSave() {
    if (!selectedId) return;
    startTransition(async () => {
      const result = await saveSponsor({ teamId, sponsorId: selectedId });
      if (result.success) {
        router.push(`/league/${leagueId}/budget`);
      } else if (result.error) {
        alert(result.error);
      }
    });
  }

  return (
    <div className="pb-32">
      <BackHeader label="Budget" />

      {/* Header */}
      <div className="px-4 pb-4 pt-2 border-b border-[var(--border-subtle)]">
        <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
          Choose your Sponsor
        </h1>
        <p className="mt-1 text-[length:var(--type-body)] text-[var(--text-mid)]">
          One sponsor per team. Change takes effect next phase.
        </p>
      </div>

      {/* Sponsors List (List Row Pattern) */}
      <div className="px-4 mt-2 max-w-[600px] mx-auto">
        {sortedSponsors.map((sponsor) => (
          <SponsorListItem
            key={sponsor.id}
            sponsor={sponsor}
            teamLevel={teamLevel}
            isSelected={selectedId === sponsor.id}
            isCurrent={currentSponsor?.sponsor_id === sponsor.id}
            onSelect={() => {
              if (teamLevel >= sponsor.unlock_level) {
                setSelectedId(sponsor.id);
              }
            }}
          />
        ))}
      </div>

      {/* Sticky save bar */}
      {hasChanges && (
        <StickyBar saveEnabled={hasChanges && !isPending} onSave={handleSave} saving={isPending}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[length:var(--type-small)] text-[var(--text-low)]">
                Selected sponsor
              </p>
              <p className="font-mono text-[length:var(--type-body)] font-semibold text-[var(--text-high)]">
                {sponsors.find((s) => s.id === selectedId)?.name ?? "—"}
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={isPending}
              className="rounded-[var(--radius-md)] cta-gradient px-5 py-2 text-[length:var(--type-body)] font-semibold text-[var(--cta-text)] disabled:opacity-40"
            >
              {isPending ? "Saving..." : "Save →"}
            </Button>
          </div>
        </StickyBar>
      )}
    </div>
  );
}
