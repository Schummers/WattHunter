"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
        {thresholdLabel(threshold)} — {label}
      </span>
      <span className="font-mono text-[length:var(--type-caption)] font-medium text-[var(--text-high)] tabular-nums">
        +{formatBudget(bonus)}
        {suffix && (
          <span className="ml-1 text-[var(--text-low)]">{suffix}</span>
        )}
      </span>
    </div>
  );
}

function BonusTable({ sponsor }: { sponsor: SponsorRow }) {
  const nationalities = expandNationality(sponsor.nationality);
  const nationalityFlag =
    nationalities.length > 0
      ? nationalities.map(countryFlag).join("")
      : null;

  if (sponsor.has_explicit_prestige) {
    // T5-T6 format: 5 lines with explicit monument/GT amounts
    return (
      <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
        {sponsor.one_day_threshold != null && sponsor.bonus_one_day > 0 && (
          <BonusLine
            label="One-Day"
            threshold={sponsor.one_day_threshold}
            bonus={sponsor.bonus_one_day}
          />
        )}
        {sponsor.monument_threshold != null && sponsor.bonus_monument != null && sponsor.bonus_monument > 0 && (
          <BonusLine
            label="Monument"
            threshold={sponsor.monument_threshold}
            bonus={sponsor.bonus_monument}
          />
        )}
        {sponsor.gc_threshold != null && sponsor.bonus_gc > 0 && (
          <BonusLine
            label="Stage Race GC"
            threshold={sponsor.gc_threshold}
            bonus={sponsor.bonus_gc}
          />
        )}
        {sponsor.grand_tour_threshold != null && sponsor.bonus_grand_tour != null && sponsor.bonus_grand_tour > 0 && (
          <BonusLine
            label="Grand Tour GC"
            threshold={sponsor.grand_tour_threshold}
            bonus={sponsor.bonus_grand_tour}
          />
        )}
        {sponsor.stage_threshold != null && sponsor.bonus_stage > 0 && (
          <BonusLine
            label="Stage"
            threshold={sponsor.stage_threshold}
            bonus={sponsor.bonus_stage}
            suffix="(×2 GT)"
          />
        )}
      </div>
    );
  }

  // T1-T4 format: 3 lines + multiplier footnotes
  const footnotes: string[] = [];
  if (sponsor.bonus_monument != null && sponsor.bonus_monument > sponsor.bonus_one_day) {
    footnotes.push("×2 Monument/GT");
  }
  if (nationalityFlag) {
    footnotes.push(`×1.5 ${nationalityFlag}`);
  }

  return (
    <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
      {sponsor.gc_threshold != null && sponsor.bonus_gc > 0 && (
        <BonusLine
          label="GC"
          threshold={sponsor.gc_threshold}
          bonus={sponsor.bonus_gc}
        />
      )}
      {sponsor.one_day_threshold != null && sponsor.bonus_one_day > 0 && (
        <BonusLine
          label="One-Day"
          threshold={sponsor.one_day_threshold}
          bonus={sponsor.bonus_one_day}
        />
      )}
      {sponsor.stage_threshold != null && sponsor.bonus_stage > 0 && (
        <BonusLine
          label="Stage"
          threshold={sponsor.stage_threshold}
          bonus={sponsor.bonus_stage}
        />
      )}
      {footnotes.length > 0 && (
        <p className="mt-1.5 text-[length:var(--type-small)] text-[var(--text-low)]">
          {footnotes.join(" · ")}
        </p>
      )}
    </div>
  );
}

function SponsorCard({
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
    <div
      className={cn(
        "rounded-[var(--radius-md)] border transition-colors",
        isSelected
          ? "border-[var(--accent-default)] bg-[var(--bg-surface-active)]"
          : "border-[var(--border-default)] bg-[var(--bg-surface)]",
        isLocked && "opacity-60",
      )}
    >
      {/* Main row — clickable to select */}
      <button
        type="button"
        disabled={isLocked}
        onClick={onSelect}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {/* Radio indicator */}
        <div
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
            isSelected
              ? "border-[var(--accent-default)] bg-[var(--accent-default)]"
              : "border-[var(--border-default)] bg-transparent",
          )}
        >
          {isSelected && <Check size={12} strokeWidth={3} className="text-[var(--bg-app)]" />}
        </div>

        {/* Lock icon (replaces radio when locked) */}
        {isLocked && (
          <div className="absolute flex h-5 w-5 shrink-0 items-center justify-center">
            <Lock size={14} className="text-[var(--text-low)]" />
          </div>
        )}

        {/* Name + badges */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[length:var(--type-body)] font-semibold text-[var(--text-high)]">
              {sponsor.name}
            </span>
            {isCurrent && (
              <Badge
                variant="highlighted"
                className="rounded-[var(--radius-pill)] px-2 py-px text-[length:var(--type-small)] font-semibold"
              >
                Current
              </Badge>
            )}
            {isLocked && (
              <Badge
                variant="default"
                className="rounded-[var(--radius-pill)] px-2 py-px text-[length:var(--type-small)] font-medium"
              >
                Lv.{sponsor.unlock_level}
              </Badge>
            )}
          </div>
        </div>

        {/* Budget */}
        <span className="font-mono text-[length:var(--type-body)] font-bold text-[var(--text-high)] tabular-nums">
          {formatBudget(sponsor.monthly_budget)}/phase
        </span>
      </button>

      {/* Expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1 border-t border-[var(--border-subtle)] px-4 py-1.5 text-[length:var(--type-small)] text-[var(--text-low)] hover:text-[var(--text-mid)] transition-colors"
      >
        <ChevronRight
          size={14}
          className={cn("transition-transform duration-200", expanded && "rotate-90")}
        />
        Bonuses
      </button>

      {/* Expanded bonus table */}
      {expanded && (
        <div className="px-4 pb-3">
          <BonusTable sponsor={sponsor} />
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

  // Group sponsors by tier
  const tiers = [...new Set(sponsors.map((s) => s.tier))].sort((a, b) => a - b);
  const bySponsor = sponsors.reduce<Record<number, SponsorRow[]>>((acc, s) => {
    if (!acc[s.tier]) acc[s.tier] = [];
    acc[s.tier].push(s);
    return acc;
  }, {});

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
      <div className="px-4 pb-1 pt-2">
        <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
          Choose your Sponsor
        </h1>
        <p className="mt-0.5 text-[length:var(--type-caption)] text-[var(--text-mid)]">
          One sponsor per team. Change takes effect next phase.
        </p>
      </div>

      {/* Tier groups */}
      <div className="mt-4 space-y-6 px-4">
        {tiers.map((tier) => (
          <div key={tier}>
            <p className="mb-2 text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
              Tier {tier}
            </p>
            <div className="space-y-2">
              {(bySponsor[tier] ?? []).map((sponsor) => (
                <SponsorCard
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
          </div>
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
