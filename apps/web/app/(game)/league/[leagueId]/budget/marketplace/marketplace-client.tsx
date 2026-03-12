"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { BackHeader } from "@/components/back-header";
import { StickyBar } from "@/components/sticky-bar";
import { Tag } from "@/components/pill";
import { formatEuro } from "@/lib/format";
import {
  formatNationalityCondition,
  formatSpecialties,
  RESULT_LABELS,
  type SponsorRow,
  type SponsorEligibility,
} from "@/lib/sponsors";
import { saveSponsors } from "../actions";

interface MarketplaceClientProps {
  leagueId: string;
  teamId: string;
  level: number;
  sponsors: SponsorRow[];
  eligibility: SponsorEligibility[];
  activeSecondary: string | null;
  activePrincipal: string | null;
}

function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `€${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
  if (amount >= 1_000) return `€${Math.round(amount / 1_000)}k`;
  return formatEuro(amount);
}

export function MarketplaceClient({
  leagueId,
  teamId,
  level,
  sponsors,
  eligibility,
  activeSecondary: initialSecondary,
  activePrincipal: initialPrincipal,
}: MarketplaceClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedSecondary, setSelectedSecondary] = useState(initialSecondary);
  const [selectedPrincipal, setSelectedPrincipal] = useState(initialPrincipal);

  const hasChanges =
    selectedSecondary !== initialSecondary || selectedPrincipal !== initialPrincipal;

  const secondarySponsors = sponsors.filter((s) => s.slot === "secondary");
  const principalSponsors = sponsors.filter((s) => s.slot === "principal");

  const eligibilityMap = useMemo(() => {
    const map: Record<string, SponsorEligibility> = {};
    for (const e of eligibility) map[e.sponsorId] = e;
    return map;
  }, [eligibility]);

  const secondaryActiveCount = selectedSecondary ? 1 : 0;
  const principalActiveCount = selectedPrincipal ? 1 : 0;

  const newMonthlyBudget = useMemo(() => {
    let total = 0;
    if (selectedSecondary) {
      const s = sponsors.find((sp) => sp.id === selectedSecondary);
      if (s) total += s.monthly_budget;
    }
    if (selectedPrincipal) {
      const s = sponsors.find((sp) => sp.id === selectedPrincipal);
      if (s) total += s.monthly_budget;
    }
    return total;
  }, [selectedSecondary, selectedPrincipal, sponsors]);

  function handleToggle(sponsor: SponsorRow, checked: boolean) {
    if (sponsor.slot === "secondary") {
      setSelectedSecondary(checked ? sponsor.id : null);
    } else {
      setSelectedPrincipal(checked ? sponsor.id : null);
    }
  }

  async function handleSave() {
    startTransition(async () => {
      const result = await saveSponsors({
        teamId,
        leagueId,
        secondary: selectedSecondary,
        principal: selectedPrincipal,
      });
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

      <div className="px-4 pb-4 pt-1">
        <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
          Choose a sponsor
        </h1>
      </div>

      <div className="mx-4 mb-5 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-3">
        <p className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)]">
          Change will take effect after the next auction phase.
        </p>
      </div>

      {/* SECONDARY SPONSOR section */}
      <div className="border-t border-[var(--border-default)] px-4 pb-1 pt-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            Secondary sponsor
          </span>
          <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
            <span className="font-semibold text-[var(--text-high)]">{secondaryActiveCount}</span> / 1 active
          </span>
        </div>
        <p className="text-[length:var(--type-caption)] text-[var(--text-ghost)]">
          T1 – T2 · Budget up to €350k/month
        </p>
      </div>

      <div className="divide-y divide-[var(--border-subtle)]">
        {secondarySponsors.map((sponsor) => (
          <SponsorRowItem
            key={sponsor.id}
            sponsor={sponsor}
            level={level}
            isActive={selectedSecondary === sponsor.id}
            eligibility={eligibilityMap[sponsor.id]}
            onToggle={(checked) => handleToggle(sponsor, checked)}
          />
        ))}
      </div>

      {/* MAIN SPONSOR section */}
      <div className="border-t border-[var(--border-default)] px-4 pb-1 pt-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            Main sponsor
          </span>
          <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
            <span className="font-semibold text-[var(--text-high)]">{principalActiveCount}</span> / 1 active
          </span>
        </div>
        <p className="text-[length:var(--type-caption)] text-[var(--text-ghost)]">
          T3 – T5 · Budget up to €1M/month · From Lv.5
        </p>
      </div>

      <div className="divide-y divide-[var(--border-subtle)]">
        {principalSponsors.map((sponsor) => (
          <SponsorRowItem
            key={sponsor.id}
            sponsor={sponsor}
            level={level}
            isActive={selectedPrincipal === sponsor.id}
            eligibility={eligibilityMap[sponsor.id]}
            onToggle={(checked) => handleToggle(sponsor, checked)}
          />
        ))}
      </div>

      {/* Sticky CTA */}
      {hasChanges && (
        <StickyBar saveEnabled={hasChanges} onSave={handleSave} saving={isPending}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
                New monthly budget
              </span>
              <div className="font-mono text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)] tabular-nums">
                {formatEuro(newMonthlyBudget)} / month
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="rounded-[var(--radius-md)] cta-gradient px-5 py-2 text-[length:var(--type-emphasis)] font-semibold text-[var(--cta-text)] disabled:opacity-40"
            >
              {isPending ? "Saving..." : "Save sponsors →"}
            </button>
          </div>
        </StickyBar>
      )}
    </div>
  );
}

function SponsorRowItem({
  sponsor,
  level,
  isActive,
  eligibility,
  onToggle,
}: {
  sponsor: SponsorRow;
  level: number;
  isActive: boolean;
  eligibility: SponsorEligibility | undefined;
  onToggle: (checked: boolean) => void;
}) {
  const isLocked = level < sponsor.unlock_level;
  const isEligible = eligibility?.eligible ?? false;
  const conditions = eligibility?.conditions;

  return (
    <div
      className={`flex flex-col gap-2 px-4 py-3 ${
        isActive ? "bg-[rgba(6,182,212,0.04)]" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
            {sponsor.name}
          </span>
          <span className="ml-1.5 inline-flex rounded-[var(--radius-pill)] bg-[var(--bg-surface-hover)] px-1.5 py-px text-[length:var(--type-micro)] font-semibold text-[var(--text-ghost)]">
            T{sponsor.tier}
          </span>
        </div>

        <span className="min-w-[60px] text-right font-mono text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)] tabular-nums">
          {formatCompact(sponsor.monthly_budget)}
        </span>

        <div className="flex min-w-[56px] justify-end">
          {isLocked ? (
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--bg-surface-hover)] px-2.5 py-1 text-[length:var(--type-micro)] font-semibold text-[var(--text-ghost)]">
              <Lock size={12} />
              Lv.{sponsor.unlock_level}
            </span>
          ) : (
            <Switch
              checked={isActive}
              disabled={!isEligible && !isActive}
              onCheckedChange={onToggle}
            />
          )}
        </div>
      </div>

      {/* Condition tags */}
      <div className="flex flex-wrap gap-1.5">
        {sponsor.tier === 1 ? (
          <Tag variant="default">No conditions</Tag>
        ) : (
          <>
            {sponsor.nationality && (
              <Tag variant={conditions?.nationality ? "success" : "default"}>
                {formatNationalityCondition(sponsor.nationality, sponsor.nationality_count)}
              </Tag>
            )}
            {sponsor.specialty.length > 0 && (
              <Tag variant={conditions?.specialty ? "success" : "default"}>
                {formatSpecialties(sponsor.specialty)}
              </Tag>
            )}
            {sponsor.result_condition && (
              <Tag variant={conditions?.result ? "success" : "default"}>
                {RESULT_LABELS[sponsor.result_condition] ?? sponsor.result_condition}
              </Tag>
            )}
          </>
        )}
      </div>
    </div>
  );
}
