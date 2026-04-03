"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Lock, ChevronDown } from "lucide-react";
import { BackHeader } from "@/components/back-header";
import { Tag } from "@/components/pill";
import { cn } from "@/lib/utils";
import {
  formatBudget,
  groupByTier,
  thresholdLabel,
  ORIENTATION_LABELS,
  type SponsorRow,
  type TeamSponsor,
} from "@/lib/sponsors";
import { countryCodeToFlag } from "@/lib/format";
import { saveSponsor } from "../actions";

interface MarketplaceClientProps {
  leagueId: string;
  teamId: string;
  teamLevel: number;
  sponsors: SponsorRow[];
  currentSponsor: TeamSponsor | null;
  nextPhaseName: string | null;
  isImmediate: boolean;
  pendingSponsorId: string | null;
  backLabel?: string;
}

// Maps ISO country codes to demonym adjectives for the nationality note
const NATIONALITY_DEMONYMS: Record<string, string> = {
  FR: "French",
  ES: "Spanish",
  BE: "Belgian",
  NL: "Dutch",
  GB: "British",
  US: "American",
  IT: "Italian",
  DK: "Danish",
  NO: "Norwegian",
};

/** Inline bonus content for Tiers 1-4 (two-column base/enhanced layout) */
function BaseBonusContent({ sponsor }: { sponsor: SponsorRow }) {
  const nationalities = sponsor.nationality
    ? sponsor.nationality.split("/").map((c) => c.trim())
    : [];

  // Grouping: GC or neutral → GC+Stage first, then One-Day
  //           one_day → One-Day first, then GC+Stage
  const isGcFirst = sponsor.orientation !== "one_day";

  const gcStageGroup = (
    <>
      {sponsor.bonus_gc > 0 && (
        <div className="flex items-baseline py-1 gap-2">
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {thresholdLabel(sponsor.gc_threshold)} GC
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[var(--text-low)] tabular-nums">
            +{formatBudget(sponsor.bonus_gc)}
          </span>
          <span className="ml-auto flex items-baseline gap-1">
            <span className="text-[10px] text-[var(--text-low)]">if Grand Tour</span>
            <span className="font-[family-name:var(--font-geist-mono)] text-[13px] font-semibold text-[var(--text-high)] tabular-nums">
              +{formatBudget(sponsor.bonus_gc * 2)}
            </span>
          </span>
        </div>
      )}
      {sponsor.bonus_stage > 0 && (
        <div className="flex items-baseline py-1 gap-2">
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {thresholdLabel(sponsor.stage_threshold)} Stage
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[var(--text-low)] tabular-nums">
            +{formatBudget(sponsor.bonus_stage)}
          </span>
          <span className="ml-auto flex items-baseline gap-1">
            <span className="text-[10px] text-[var(--text-low)]">if Grand Tour</span>
            <span className="font-[family-name:var(--font-geist-mono)] text-[13px] font-semibold text-[var(--text-high)] tabular-nums">
              +{formatBudget(sponsor.bonus_stage * 2)}
            </span>
          </span>
        </div>
      )}
    </>
  );

  const oneDayGroup = (
    <>
      {sponsor.bonus_one_day > 0 && (
        <div className="flex items-baseline py-1 gap-2">
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {thresholdLabel(sponsor.one_day_threshold)} One-Day
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[var(--text-low)] tabular-nums">
            +{formatBudget(sponsor.bonus_one_day)}
          </span>
          <span className="ml-auto flex items-baseline gap-1">
            <span className="text-[10px] text-[var(--text-low)]">if Monument</span>
            <span className="font-[family-name:var(--font-geist-mono)] text-[13px] font-semibold text-[var(--text-high)] tabular-nums">
              +{formatBudget(sponsor.bonus_one_day * 2)}
            </span>
          </span>
        </div>
      )}
    </>
  );

  return (
    <div>
      {/* Section title */}
      <div className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] mt-1 pt-2 border-t border-[var(--border-default)]">
        Base Bonus
      </div>

      {/* Rows */}
      {isGcFirst ? (
        <>
          {gcStageGroup}
          <div className="border-t border-[var(--border-subtle)] my-1.5" />
          {oneDayGroup}
        </>
      ) : (
        <>
          {oneDayGroup}
          <div className="border-t border-[var(--border-subtle)] my-1.5" />
          {gcStageGroup}
        </>
      )}

      {/* Nationality note */}
      {nationalities.length > 0 && (
        <div className="flex items-center gap-1.5 border-t border-[var(--border-default)] mt-2.5 pt-2.5 text-[11px] text-[var(--text-low)]">
          {nationalities.map((nat) => (
            <span key={nat}>{countryCodeToFlag(nat)}</span>
          ))}
          <span>
            {nationalities
              .map((nat) => NATIONALITY_DEMONYMS[nat] ?? nat)
              .join(" / ")}{" "}
            rider: all bonuses ×1.5
          </span>
        </div>
      )}
    </div>
  );
}

/** Inline bonus content for Tiers 5-6 (prestige single-column layout) */
function PrestigeBonusContent({ sponsor }: { sponsor: SponsorRow }) {
  // Stage-race group: Grand Tour GC, Stage (GT), Stage (regular)
  // One-day group: Monument, One-Day

  const hasGrandTourGC =
    sponsor.bonus_grand_tour != null &&
    sponsor.bonus_grand_tour > 0 &&
    sponsor.grand_tour_threshold != null;
  const hasMonument =
    sponsor.bonus_monument != null &&
    sponsor.bonus_monument > 0 &&
    sponsor.monument_threshold != null;

  return (
    <div>
      {/* Section title */}
      <div className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] mt-1 pt-2 border-t border-[var(--border-default)]">
        Prestige Bonus
      </div>

      {/* Stage-race group */}
      {hasGrandTourGC && (
        <div className="flex items-baseline justify-between py-1">
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {thresholdLabel(sponsor.grand_tour_threshold!)} Grand Tour GC
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[13px] font-semibold text-[var(--text-high)] tabular-nums">
            +{formatBudget(sponsor.bonus_grand_tour!)}
          </span>
        </div>
      )}
      {sponsor.bonus_gc > 0 && (
        <div className="flex items-baseline justify-between py-1">
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {thresholdLabel(sponsor.gc_threshold)} Stage Race GC
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[13px] font-semibold text-[var(--text-high)] tabular-nums">
            +{formatBudget(sponsor.bonus_gc)}
          </span>
        </div>
      )}
      {sponsor.bonus_stage > 0 && (
        <div className="flex items-baseline justify-between py-1">
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {thresholdLabel(sponsor.stage_threshold)} Stage
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[13px] font-semibold text-[var(--text-high)] tabular-nums">
            +{formatBudget(sponsor.bonus_stage)}
          </span>
        </div>
      )}

      {/* Divider between stage-race and one-day groups */}
      {(hasGrandTourGC || sponsor.bonus_gc > 0 || sponsor.bonus_stage > 0) &&
        (hasMonument || sponsor.bonus_one_day > 0) && (
          <div className="border-t border-[var(--border-subtle)] my-1.5" />
        )}

      {/* One-day group */}
      {hasMonument && (
        <div className="flex items-baseline justify-between py-1">
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {thresholdLabel(sponsor.monument_threshold!)} Monument
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[13px] font-semibold text-[var(--text-high)] tabular-nums">
            +{formatBudget(sponsor.bonus_monument!)}
          </span>
        </div>
      )}
      {sponsor.bonus_one_day > 0 && (
        <div className="flex items-baseline justify-between py-1">
          <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
            {thresholdLabel(sponsor.one_day_threshold)} One-Day
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[13px] font-semibold text-[var(--text-high)] tabular-nums">
            +{formatBudget(sponsor.bonus_one_day)}
          </span>
        </div>
      )}
    </div>
  );
}

function SponsorCard({
  sponsor,
  teamLevel,
  isSelected,
  defaultExpanded,
  onToggle,
}: {
  sponsor: SponsorRow;
  teamLevel: number;
  isSelected: boolean;
  defaultExpanded: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isLocked = teamLevel < sponsor.unlock_level;
  const nationalities = sponsor.nationality
    ? sponsor.nationality.split("/").map((c) => c.trim())
    : [];

  const handleHeaderClick = useCallback(() => {
    if (isLocked) return;
    setExpanded((v) => !v);
  }, [isLocked]);

  const handleRadioClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isLocked) {
        onToggle();
      }
    },
    [isLocked, onToggle],
  );

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isLocked) {
        setExpanded((v) => !v);
      }
    },
    [isLocked],
  );

  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border bg-[var(--bg-surface)] transition-colors",
        isSelected
          ? "border-2 border-[var(--accent-default)]"
          : "border-[var(--border-default)]",
        isLocked && "opacity-40",
      )}
    >
      {/* Header row — click to expand */}
      <button
        type="button"
        onClick={handleHeaderClick}
        disabled={isLocked}
        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
      >
        {/* Radio button */}
        <div
          role="radio"
          aria-checked={isSelected}
          onClick={handleRadioClick}
          className={cn(
            "shrink-0 h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center transition-colors",
            isSelected
              ? "border-[var(--accent-default)] bg-[var(--accent-default)]"
              : "border-[var(--border-default)] bg-transparent",
          )}
        >
          {isSelected && (
            <div className="h-[7px] w-[7px] rounded-full bg-[var(--bg-app)]" />
          )}
        </div>

        {/* Name */}
        <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          {sponsor.name}
        </span>

        {/* Orientation tag */}
        <Tag variant="highlighted">{ORIENTATION_LABELS[sponsor.orientation]}</Tag>

        {/* Nationality flags — inline */}
        {nationalities.map((nat) => (
          <span key={nat} className="text-[length:var(--type-caption)]">
            {countryCodeToFlag(nat)}
          </span>
        ))}

        {/* Amount + chevron — far right */}
        <span className="ml-auto font-[family-name:var(--font-geist-mono)] text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)] tabular-nums">
          {formatBudget(sponsor.monthly_budget)}
        </span>
        <ChevronDown
          size={16}
          onClick={handleChevronClick}
          className={cn(
            "shrink-0 text-[var(--text-low)] transition-transform duration-200",
            expanded && "rotate-180",
          )}
        />
      </button>

      {/* Expanded bonus content — indented past radio */}
      {expanded && !isLocked && (
        <div className="pl-[42px] pr-3.5 pb-3.5">
          {sponsor.has_explicit_prestige ? (
            <PrestigeBonusContent sponsor={sponsor} />
          ) : (
            <BaseBonusContent sponsor={sponsor} />
          )}
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
  nextPhaseName,
  isImmediate,
  pendingSponsorId,
  backLabel = "Budget",
}: MarketplaceClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{
    type: "immediate" | "pending";
    name: string;
  } | null>(
    // Show pending banner on load if there's a pending sponsor change
    pendingSponsorId
      ? {
          type: "pending",
          name: sponsors.find((s) => s.id === pendingSponsorId)?.name ?? "",
        }
      : null,
  );

  const activeSponsorId = currentSponsor?.sponsor_id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(activeSponsorId);

  const tierGroups = groupByTier(sponsors);

  // Find the highest unlocked tier for default expand
  const highestUnlockedTier = Math.max(
    ...sponsors
      .filter((s) => teamLevel >= s.unlock_level)
      .map((s) => s.tier),
    0,
  );

  const handleToggle = useCallback(
    (sponsorId: string) => {
      if (isPending) return;
      if (sponsorId === activeSponsorId) return; // already active

      setSelectedId(sponsorId);
      const sponsorName = sponsors.find((s) => s.id === sponsorId)?.name ?? "";

      startTransition(async () => {
        const result = await saveSponsor({ teamId, sponsorId });
        if (result.success) {
          setBanner({
            type: result.immediate ? "immediate" : "pending",
            name: result.sponsorName ?? sponsorName,
          });
          router.refresh();
        } else if (result.error) {
          // Revert on error
          setSelectedId(activeSponsorId);
          alert(result.error);
        }
      });
    },
    [isPending, activeSponsorId, sponsors, teamId, startTransition, router],
  );

  return (
    <div className="pb-24">
      <BackHeader label={backLabel} />

      {/* Header */}
      <div className="px-4 pb-4 pt-2">
        <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
          Choose your Sponsor
        </h1>
        <p className="mt-1 text-[length:var(--type-body)] text-[var(--text-mid)]">
          One sponsor per team.
        </p>
      </div>

      {/* Confirmation banner */}
      {banner?.type === "immediate" && (
        <div className="mx-4 mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
          <p className="text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
            ✓ {banner.name} — changes applied
          </p>
        </div>
      )}
      {banner?.type === "pending" && (
        <div className="mx-4 mb-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
          <p className="text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
            ⏳ {banner.name} — active from {nextPhaseName ?? "next phase"}
          </p>
        </div>
      )}

      {/* Tier groups */}
      <div className="px-4 max-w-[600px] mx-auto">
        {tierGroups.map((group, groupIdx) => (
          <div key={group.tier} className={cn(groupIdx > 0 && "mt-5")}>
            {/* Tier section header — single line */}
            <div className="text-[length:var(--type-caption)] font-semibold uppercase tracking-wide text-[var(--text-low)] pb-2">
              Tier {group.tier} · Level {group.unlockLevel}
              {teamLevel < group.unlockLevel && (
                <Lock size={12} className="inline ml-1.5 align-baseline" />
              )}
            </div>

            {/* Sponsor cards — gap between cards (no divider lines) */}
            <div className="flex flex-col gap-2">
              {group.sponsors.map((sponsor) => (
                <SponsorCard
                  key={sponsor.id}
                  sponsor={sponsor}
                  teamLevel={teamLevel}
                  isSelected={selectedId === sponsor.id}
                  defaultExpanded={group.tier === highestUnlockedTier}
                  onToggle={() => handleToggle(sponsor.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
