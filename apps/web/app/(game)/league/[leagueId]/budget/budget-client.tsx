"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { PhaseNavigator } from "@/components/phase-navigator";
import { FilterChips } from "@/components/filter-chips";
import { TransactionRow } from "@/components/transaction-row";
import { Tag } from "@/components/pill";
import { SponsorBonusDetails } from "@/components/sponsor-bonus-details";
import { formatEuro, countryCodeToFlag } from "@/lib/format";
import { AUCTION_PHASES, getCurrentPhase } from "@/lib/phases";
import {
  formatBudget,
  ORIENTATION_LABELS,
  TRANSACTION_FILTER_OPTIONS,
  filterTransactions,
  type SponsorRow,
} from "@/lib/sponsors";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  rider_photo_url?: string | null;
  rider_name?: string | null;
}

interface BudgetClientProps {
  leagueId: string;
  treasury: number;
  level: number;
  income: number;
  outgoing: number;
  transactions: Transaction[];
  phaseIndex: number;
  currentSponsor: SponsorRow | null;
  phaseSalaries: number;
}

function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M €`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k €`;
  return formatEuro(amount);
}

export function BudgetClient({
  leagueId,
  treasury,
  income,
  outgoing: _outgoing,
  transactions,
  currentSponsor,
  phaseIndex,
  phaseSalaries,
}: BudgetClientProps) {
  const router = useRouter();
  const [filterIndex, setFilterIndex] = useState(0);
  const [sponsorExpanded, setSponsorExpanded] = useState(false);

  const filtered = useMemo(
    () => filterTransactions(transactions, filterIndex),
    [transactions, filterIndex],
  );

  // Determine the real current phase index to prevent future navigation
  const realCurrentPhaseIndex = useMemo(() => {
    const current = getCurrentPhase();
    return AUCTION_PHASES.findIndex((p) => p.id === current.id);
  }, []);

  function handlePhaseChange(newIndex: number) {
    router.replace(`?phase=${newIndex}`, { scroll: false });
  }

  const nationalities = currentSponsor?.nationality
    ? currentSponsor.nationality.split("/").map((c) => c.trim())
    : [];

  const sponsorBase = currentSponsor?.monthly_budget ?? 0;
  const bonuses = income - sponsorBase;
  const phaseResult = sponsorBase + bonuses - phaseSalaries;
  const isBankruptcyRisk = phaseSalaries > sponsorBase;

  return (
    <div className="pb-24">
      {/* Phase Navigator */}
      <PhaseNavigator
        currentIndex={phaseIndex}
        onChange={handlePhaseChange}
        maxIndex={realCurrentPhaseIndex}
      />

      {/* Treasury Hero Card */}
      <div className="xp-card-body mx-4 mt-1 p-5">
        <div className="xp-content">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            Treasury
          </span>
          <div className="mt-1 font-[family-name:var(--font-geist-mono)] text-[length:var(--type-display)] font-black leading-none text-[var(--accent-highlight)] tabular-nums">
            {formatEuro(treasury)}
          </div>

          {/* P&L rows */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[length:var(--type-caption)]">
              <span className="text-[var(--text-low)]">Sponsor</span>
              <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-high)] tabular-nums">
                +{formatCompact(sponsorBase)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[length:var(--type-caption)]">
              <span className="text-[var(--text-low)]">Bonuses</span>
              <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-high)] tabular-nums">
                +{formatCompact(Math.max(0, bonuses))}
              </span>
            </div>
            <div className="flex items-center justify-between text-[length:var(--type-caption)]">
              <span className="text-[var(--text-low)]">Salaries</span>
              <span className="font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--text-high)] tabular-nums">
                -{formatCompact(phaseSalaries)}
              </span>
            </div>
            <div className="border-t border-white/10 pt-1.5">
              <div className="flex items-center justify-between text-[length:var(--type-caption)]">
                <span className="font-semibold text-[var(--text-high)]">Phase result</span>
                <span className="font-[family-name:var(--font-geist-mono)] font-bold text-[var(--text-high)] tabular-nums">
                  {phaseResult >= 0 ? "+" : ""}{formatCompact(phaseResult)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bankruptcy risk warning */}
      {isBankruptcyRisk && (
        <div className="mx-4 mt-2 flex items-center gap-1.5 rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/8 px-3 py-2 text-[length:var(--type-caption)] text-red-400">
          <span>⚠</span>
          <span>Bankruptcy risk — your salaries exceed your sponsor income</span>
        </div>
      )}

      {/* Sponsor Section */}
      <div className="mt-6 mb-0">
        <div className="flex items-center justify-between px-4 mb-2">
          <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Sponsor
          </span>
          <Link
            href={`/league/${leagueId}/budget/marketplace`}
            className="text-[length:var(--type-caption)] font-medium text-[var(--accent-default)] hover:text-[var(--accent-hover)] transition-colors"
          >
            Change &rarr;
          </Link>
        </div>

        <div className="px-4">
          {currentSponsor ? (
            <button
              type="button"
              onClick={() => setSponsorExpanded((v) => !v)}
              className="block w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-left transition-colors hover:bg-[var(--bg-surface-hover)]"
            >
              {/* Single line: chevron + name + tags + flags + amount */}
              <div className="flex items-center gap-2">
                <ChevronDown
                  size={14}
                  className={cn(
                    "shrink-0 text-[var(--text-low)] transition-transform duration-200",
                    sponsorExpanded && "rotate-180",
                  )}
                />
                <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                  {currentSponsor.name}
                </span>
                <Tag variant="highlighted">{ORIENTATION_LABELS[currentSponsor.orientation]}</Tag>
                {nationalities.map((nat) => (
                  <Tag key={nat} variant="default">{countryCodeToFlag(nat)}</Tag>
                ))}
                <span className="ml-auto font-[family-name:var(--font-geist-mono)] text-[length:var(--type-stat-small)] font-bold text-[var(--text-high)] tabular-nums">
                  {formatBudget(currentSponsor.monthly_budget)}
                </span>
              </div>

              {/* Expanded bonus details */}
              {sponsorExpanded && (
                <div className="pl-[22px] mt-2">
                  <SponsorBonusDetails sponsor={currentSponsor} />
                </div>
              )}
            </button>
          ) : (
            <Link href={`/league/${leagueId}/budget/marketplace`}>
              <div className="flex items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-5 hover:bg-[var(--bg-surface-hover)] transition-colors">
                <span className="text-[length:var(--type-caption)] font-medium text-[var(--accent-default)]">
                  Select a sponsor &rarr;
                </span>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Transactions Section */}
      <div className="mt-6 mb-4">
        <div className="flex items-center justify-between px-4 mb-2">
          <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Transactions
          </span>
          <Link
            href={`/league/${leagueId}/budget/transactions`}
            className="text-[length:var(--type-caption)] font-medium text-[var(--accent-default)] hover:text-[var(--accent-hover)] transition-colors"
          >
            See all &rarr;
          </Link>
        </div>

        <div className="px-4 mb-3 border-b border-[var(--border-subtle)] pb-3">
          <FilterChips
            options={TRANSACTION_FILTER_OPTIONS}
            activeIndex={filterIndex}
            onChange={setFilterIndex}
          />
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-[length:var(--type-caption)] text-[var(--text-low)]">
              No transactions this phase
            </p>
          ) : (
            filtered.map((t) => (
              <TransactionRow
                key={t.id}
                type={t.type}
                amount={t.amount}
                description={t.description}
                date={t.created_at}
                riderPhotoUrl={t.rider_photo_url}
                riderName={t.rider_name}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
