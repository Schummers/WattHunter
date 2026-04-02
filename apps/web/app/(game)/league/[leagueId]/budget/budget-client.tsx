"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhaseNavigator } from "@/components/phase-navigator";
import { FilterChips } from "@/components/filter-chips";
import { TransactionRow } from "@/components/transaction-row";
import { formatEuro } from "@/lib/format";
import { formatBudget } from "@/lib/sponsors";

interface SponsorInfo {
  id: string;
  name: string;
  tier: number;
  monthly_budget: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

interface BudgetClientProps {
  leagueId: string;
  treasury: number;
  level: number;
  income: number;
  outgoing: number;
  transactions: Transaction[];
  phaseIndex: number;
  currentSponsor: SponsorInfo | null;
  phaseSalaries: number;
}

const FILTER_OPTIONS = [
  { label: "All" },
  { label: "Bonuses" },
  { label: "Salaries" },
  { label: "Sponsors" },
];

function filterTransactions(transactions: Transaction[], filterIndex: number): Transaction[] {
  if (filterIndex === 0) return transactions;
  if (filterIndex === 1) return transactions.filter((t) => ["rider_revenue", "monthly_bonus", "sponsor_bonus"].includes(t.type));
  if (filterIndex === 2) return transactions.filter((t) => ["monthly_salary", "phase_salary", "auction_purchase"].includes(t.type));
  if (filterIndex === 3) return transactions.filter((t) => ["sponsor_payment", "phase_sponsor_base"].includes(t.type));
  return transactions;
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
  phaseSalaries,
  phaseIndex,
}: BudgetClientProps) {
  const router = useRouter();
  const [filterIndex, setFilterIndex] = useState(0);

  const filtered = useMemo(
    () => filterTransactions(transactions, filterIndex),
    [transactions, filterIndex],
  );

  function handlePhaseChange(newIndex: number) {
    router.replace(`?phase=${newIndex}`, { scroll: false });
  }

  return (
    <div className="pb-24">
      {/* Phase Navigator */}
      <PhaseNavigator currentIndex={phaseIndex} onChange={handlePhaseChange} />

      {/* Balance Hero Card (Brand Card Style without hover states) */}
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

      {/* Sponsor Section (Moved up) */}
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
            <Link
              href={`/league/${leagueId}/budget/marketplace`}
              className="block rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 transition-colors hover:bg-[var(--bg-surface-hover)]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                    {currentSponsor.name}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="tag tag-default">Tier {currentSponsor.tier}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[length:var(--type-stat-small)] font-semibold text-[var(--text-high)] tabular-nums">
                    {formatCompact(currentSponsor.monthly_budget)}
                  </div>
                  <div className="text-[length:var(--type-micro)] text-[var(--text-low)]">/ phase</div>
                </div>
              </div>
            </Link>
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
            options={FILTER_OPTIONS}
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
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
