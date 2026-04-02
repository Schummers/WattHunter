"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PhaseNavigator } from "@/components/phase-navigator";
import { FilterChips } from "@/components/filter-chips";
import { TransactionRow } from "@/components/transaction-row";
import { Tag } from "@/components/pill";
import { SponsorBonusDetails } from "@/components/sponsor-bonus-details";
import { formatEuro, countryCodeToFlag } from "@/lib/format";
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
  outgoing,
  transactions,
  currentSponsor,
  phaseIndex,
}: BudgetClientProps) {
  const router = useRouter();
  const [filterIndex, setFilterIndex] = useState(0);
  const [sponsorExpanded, setSponsorExpanded] = useState(false);

  const filtered = useMemo(
    () => filterTransactions(transactions, filterIndex),
    [transactions, filterIndex],
  );

  function handlePhaseChange(newIndex: number) {
    router.replace(`?phase=${newIndex}`, { scroll: false });
  }

  const nationalities = currentSponsor?.nationality
    ? currentSponsor.nationality.split("/").map((c) => c.trim())
    : [];

  return (
    <div className="pb-24">
      {/* Phase Navigator */}
      <PhaseNavigator currentIndex={phaseIndex} onChange={handlePhaseChange} />

      {/* Balance Hero Card */}
      <div className="xp-card-body mx-4 mt-2 p-5 mb-6">
        <div className="xp-content">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            Balance
          </span>
          <div className="mt-1 font-mono text-[length:var(--type-display)] font-black leading-none text-[var(--accent-highlight)] tabular-nums">
            {formatEuro(treasury)}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[length:var(--type-caption)]">
            <span className="text-[var(--text-low)]">
              Income{" "}
              <span className="font-mono font-semibold text-[var(--text-high)]">+{formatCompact(income)}</span>
            </span>
            <span className="text-[var(--text-low)]">
              Outgoing{" "}
              <span className="font-mono font-semibold text-[var(--text-high)]">-{formatCompact(outgoing)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Sponsor Section */}
      <div className="mt-2 mb-6">
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
              {/* Line 1: chevron + name + budget */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChevronRight
                    size={14}
                    className={cn(
                      "shrink-0 text-[var(--text-low)] transition-transform duration-200",
                      sponsorExpanded && "rotate-90",
                    )}
                  />
                  <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                    {currentSponsor.name}
                  </span>
                </div>
                <span className="font-mono text-[length:var(--type-stat-small)] font-bold text-[var(--text-high)] tabular-nums">
                  {formatBudget(currentSponsor.monthly_budget)}
                </span>
              </div>

              {/* Line 2: tags */}
              <div className="flex items-center gap-1.5 mt-1 pl-[22px]">
                <Tag variant="highlighted">{ORIENTATION_LABELS[currentSponsor.orientation]}</Tag>
                {nationalities.map((nat) => (
                  <Tag key={nat} variant="default">{countryCodeToFlag(nat)}</Tag>
                ))}
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
      <div className="mt-2 mb-4">
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
