"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhaseNavigator } from "@/components/phase-navigator";
import { SegmentedControl } from "@/components/segmented-control";
import { TransactionRow } from "@/components/transaction-row";
import { Tag } from "@/components/pill";
import { formatEuro } from "@/lib/format";
import {
  formatNationalityCondition,
  formatSpecialties,
  RESULT_LABELS,
} from "@/lib/sponsors";

interface SponsorInfo {
  id: string;
  name: string;
  abbreviation: string;
  tier: number;
  slot: string;
  monthly_budget: number;
  nationality: string | null;
  nationality_count: number;
  specialty: string[];
  result_condition: string | null;
}

interface TeamSponsorEntry {
  id: string;
  slot: "secondary" | "principal";
  sponsor: SponsorInfo;
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
  teamSponsors: TeamSponsorEntry[];
  phaseIndex: number;
}

const FILTER_SEGMENTS = ["All", "Bonuses", "Salaries", "Sponsors"];

function filterTransactions(transactions: Transaction[], filterIndex: number): Transaction[] {
  if (filterIndex === 0) return transactions;
  if (filterIndex === 1) return transactions.filter((t) => t.type === "rider_revenue" || t.type === "monthly_bonus");
  if (filterIndex === 2) return transactions.filter((t) => t.type === "monthly_salary" || t.type === "auction_purchase");
  if (filterIndex === 3) return transactions.filter((t) => t.type === "sponsor_payment");
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
  level,
  income,
  outgoing,
  transactions,
  teamSponsors,
  phaseIndex,
}: BudgetClientProps) {
  const router = useRouter();
  const [filterIndex, setFilterIndex] = useState(0);

  const filtered = useMemo(
    () => filterTransactions(transactions, filterIndex),
    [transactions, filterIndex],
  );

  const secondary = teamSponsors.find((ts) => ts.slot === "secondary");
  const principal = teamSponsors.find((ts) => ts.slot === "principal");
  const hasPrincipalSlot = level >= 5;

  function handlePhaseChange(newIndex: number) {
    router.replace(`?phase=${newIndex}`, { scroll: false });
  }

  return (
    <div className="pb-24">
      {/* Phase Navigator */}
      <PhaseNavigator currentIndex={phaseIndex} onChange={handlePhaseChange} />

      {/* Balance Hero Card */}
      <div className="xp-card-body mx-4 mt-2 rounded-xl p-5">
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

      {/* Transactions Section */}
      <div className="mt-6">
        <div className="flex items-center justify-between px-4 mb-2">
          <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Transactions
          </span>
          <Link
            href={`/league/${leagueId}/budget/transactions`}
            className="text-[length:var(--type-caption)] font-medium text-[var(--accent-default)]"
          >
            See all &rarr;
          </Link>
        </div>

        <div className="px-4 mb-3">
          <SegmentedControl
            segments={FILTER_SEGMENTS}
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

      {/* Sponsors Section */}
      <div className="mt-6">
        <div className="flex items-center justify-between px-4 mb-2">
          <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Sponsors
          </span>
          <Link
            href={`/league/${leagueId}/budget/marketplace`}
            className="text-[length:var(--type-caption)] font-medium text-[var(--accent-default)]"
          >
            Change &rarr;
          </Link>
        </div>

        <p className="px-4 mb-2 text-[length:var(--type-caption)] text-[var(--text-ghost)]">
          Change will take effect after the next auction phase.
        </p>

        <div className="space-y-3 px-4">
          {/* Secondary sponsor */}
          {secondary ? (
            <SponsorCard
              sponsor={secondary.sponsor}
              slotLabel="Secondary"
              leagueId={leagueId}
            />
          ) : (
            <EmptySponsorSlot label="Secondary" leagueId={leagueId} />
          )}

          {/* Principal sponsor — only show if level >= 5 */}
          {hasPrincipalSlot && (
            principal ? (
              <SponsorCard
                sponsor={principal.sponsor}
                slotLabel="Main"
                leagueId={leagueId}
              />
            ) : (
              <EmptySponsorSlot label="Main" leagueId={leagueId} />
            )
          )}
        </div>
      </div>
    </div>
  );
}

function SponsorCard({
  sponsor,
  slotLabel,
  leagueId,
}: {
  sponsor: SponsorInfo;
  slotLabel: string;
  leagueId: string;
}) {
  return (
    <Link
      href={`/league/${leagueId}/budget/marketplace`}
      className="block rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 transition-colors hover:bg-[var(--bg-surface-hover)]"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
            {sponsor.name}
          </div>
          <div className="text-[length:var(--type-caption)] text-[var(--text-low)]">
            {slotLabel} · T{sponsor.tier}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[length:var(--type-stat)] font-extrabold text-[var(--text-high)] tabular-nums">
            {formatCompact(sponsor.monthly_budget)}
          </div>
          <div className="text-[length:var(--type-micro)] text-[var(--text-low)]">/ month</div>
        </div>
      </div>

      {/* Condition tags */}
      {(sponsor.nationality || sponsor.specialty.length > 0 || sponsor.result_condition) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sponsor.nationality && (
            <Tag variant="default">
              {formatNationalityCondition(sponsor.nationality, sponsor.nationality_count)}
            </Tag>
          )}
          {sponsor.specialty.length > 0 && (
            <Tag variant="default">{formatSpecialties(sponsor.specialty)}</Tag>
          )}
          {sponsor.result_condition && (
            <Tag variant="default">
              {RESULT_LABELS[sponsor.result_condition] ?? sponsor.result_condition}
            </Tag>
          )}
        </div>
      )}
    </Link>
  );
}

function EmptySponsorSlot({ label, leagueId }: { label: string; leagueId: string }) {
  return (
    <Link href={`/league/${leagueId}/budget/marketplace`}>
      <div className="flex items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-default)] px-4 py-5">
        <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-ghost)]">
          Choose a {label.toLowerCase()} sponsor
        </span>
      </div>
    </Link>
  );
}
