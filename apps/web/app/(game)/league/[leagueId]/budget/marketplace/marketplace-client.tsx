"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Lock, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { BackHeader } from "@/components/back-header";
import { Tag } from "@/components/pill";
import { SponsorBonusDetails } from "@/components/sponsor-bonus-details";
import { cn } from "@/lib/utils";
import {
  formatBudget,
  groupByTier,
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
}

function SponsorRow({
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

  const handleRowClick = useCallback(() => {
    setExpanded((v) => !v);
  }, []);

  return (
    <div className={cn(isLocked && "opacity-40")}>
      {/* Clickable row — expand/collapse */}
      <button
        type="button"
        onClick={handleRowClick}
        className="flex w-full flex-col gap-1 py-4 text-left"
      >
        {/* Line 1: chevron + name */}
        <div className="flex items-center gap-2">
          <ChevronRight
            size={14}
            className={cn(
              "shrink-0 text-[var(--text-low)] transition-transform duration-200",
              expanded && "rotate-90",
            )}
          />
          <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
            {sponsor.name}
          </span>
        </div>

        {/* Line 2: tags left, budget + toggle right */}
        <div className="flex items-center justify-between pl-[22px]">
          <div className="flex items-center gap-1.5">
            <Tag variant="highlighted">{ORIENTATION_LABELS[sponsor.orientation]}</Tag>
            {nationalities.map((nat) => (
              <Tag key={nat} variant="default">{countryCodeToFlag(nat)}</Tag>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-[length:var(--type-stat-small)] font-bold text-[var(--text-high)] tabular-nums">
              {formatBudget(sponsor.monthly_budget)}
            </span>
            {isLocked ? (
              <Lock size={16} className="text-[var(--text-low)]" />
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
              >
                <Switch checked={isSelected} />
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Expanded bonus details */}
      {expanded && (
        <div className="pl-[22px] pb-4">
          <SponsorBonusDetails sponsor={sponsor} />
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
}: MarketplaceClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{
    type: "immediate" | "pending";
    name: string;
  } | null>(
    // Show pending banner on load if there's a pending sponsor change
    pendingSponsorId
      ? { type: "pending", name: sponsors.find((s) => s.id === pendingSponsorId)?.name ?? "" }
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
      <BackHeader label="Budget" />

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
          <div
            key={group.tier}
            className={cn(groupIdx > 0 && "mt-5")}
          >
            {/* Tier section header */}
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
                Tier {group.tier}
              </span>
              <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-low)]">
                Lv. {group.unlockLevel}
              </span>
            </div>

            {/* Sponsor rows */}
            <div className="divide-y divide-[var(--border-subtle)]">
              {group.sponsors.map((sponsor) => (
                <SponsorRow
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
