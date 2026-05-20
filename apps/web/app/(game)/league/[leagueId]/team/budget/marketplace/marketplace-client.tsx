"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Lock, ChevronDown } from "lucide-react";
import { BackHeader } from "@/components/back-header";
import { Tag } from "@/components/pill";
import {
  BaseBonusContent,
  PrestigeBonusContent,
  NATIONALITY_DEMONYMS,
} from "@/components/sponsor-bonus-card";
import { GtGoalsPreview } from "@/components/gt-goals-preview";
import { getGoalsForSponsor } from "@/lib/gt-goals";
import { cn } from "@/lib/utils";
import {
  formatBudget,
  groupByTier,
  getOrientationTags,
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

        {/* Name + tags + budget */}
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          {/* Line 1: Name + Budget */}
          <div className="flex items-center gap-2.5">
            <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
              {sponsor.name}
            </span>
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
          </div>
          {/* Line 2: Tags */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {getOrientationTags(sponsor).map((tag) => (
              <Tag key={tag} variant="highlighted">{tag}</Tag>
            ))}
            {nationalities.length > 0 && (
              <Tag variant="highlighted">
                {nationalities.map((nat) => countryCodeToFlag(nat)).join(" ")}
              </Tag>
            )}
          </div>
        </div>
      </button>

      {/* Expanded bonus content — indented past radio */}
      {/* DS-EXCEPTION: pl-[42px] aligns with radio button (h-[18px] + gap-2.5 + px-3.5) — no Tailwind utility maps to this exact layout constraint */}
      {expanded && !isLocked && (
        <div className="pl-[42px] pr-3.5 pb-3.5">
          {sponsor.has_explicit_prestige ? (
            <PrestigeBonusContent sponsor={sponsor} />
          ) : (
            <BaseBonusContent sponsor={sponsor} />
          )}
          <GtGoalsPreview goals={getGoalsForSponsor(sponsor.slug)} />
          {nationalities.length > 0 && (
            <div className="flex items-center gap-1.5 border-t border-[var(--border-default)] mt-2.5 pt-2.5 text-[length:var(--type-caption)] text-[var(--text-low)]">
              {nationalities.map((nat) => (
                <span key={nat}>{countryCodeToFlag(nat)}</span>
              ))}
              <span>
                {nationalities
                  .map((nat) => NATIONALITY_DEMONYMS[nat] ?? nat)
                  .join(" / ")}{" "}
                rider: all bonuses ×1.25
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MarketplaceClient({
  teamId,
  teamLevel,
  sponsors,
  currentSponsor,
  nextPhaseName,
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
          One sponsor per team — switch anytime during the auction window (Round 1 → Round 3).
        </p>
      </div>

      {/* Confirmation banner */}
      {banner?.type === "immediate" && (
        <div className="mx-4 mb-4 rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3">
          <p className="text-[length:var(--type-caption)] font-semibold text-[var(--text-high)]">
            ✓ {banner.name} — changes applied
          </p>
        </div>
      )}
      {banner?.type === "pending" && (
        <div className="mx-4 mb-4 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3">
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
