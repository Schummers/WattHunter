"use client";

import { useState, useMemo } from "react";
import { BackHeader } from "@/components/back-header";
import { SegmentedControl } from "@/components/segmented-control";
import { TransactionRow } from "@/components/transaction-row";
import { formatMoney } from "@/lib/format";
import {
  TRANSACTION_FILTER_OPTIONS,
  filterTransactions,
} from "@/lib/sponsors";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  rider_photo_url?: string | null;
  rider_name?: string | null;
}

interface TransactionsClientProps {
  transactions: Transaction[];
}

const FILTER_SEGMENTS = TRANSACTION_FILTER_OPTIONS.map((o) => o.label);

function groupByMonth(transactions: Transaction[]): { label: string; net: number; items: Transaction[] }[] {
  const groups: Record<string, { label: string; net: number; items: Transaction[] }> = {};
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  for (const t of transactions) {
    const d = new Date(t.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    if (!groups[key]) {
      groups[key] = {
        label: `${months[d.getMonth()].toUpperCase()} ${d.getFullYear()}`,
        net: 0,
        items: [],
      };
    }
    groups[key].net += t.amount;
    groups[key].items.push(t);
  }

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([, v]) => v);
}

export function TransactionsClient({ transactions }: TransactionsClientProps) {
  const [filterIndex, setFilterIndex] = useState(0);

  const filtered = useMemo(
    () => filterTransactions(transactions, filterIndex),
    [transactions, filterIndex],
  );

  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);

  return (
    <div className="pb-24">
      <BackHeader label="Budget" />

      <div className="px-4 py-3">
        <SegmentedControl
          segments={FILTER_SEGMENTS}
          activeIndex={filterIndex}
          onChange={setFilterIndex}
        />
      </div>

      {grouped.length === 0 ? (
        <p className="px-4 py-8 text-center text-[length:var(--type-caption)] text-[var(--text-low)]">
          No transactions yet
        </p>
      ) : (
        grouped.map((group) => (
          <div key={group.label}>
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                {group.label}
              </span>
              <span className="font-mono text-[length:var(--type-caption)] font-semibold text-[var(--text-high)] tabular-nums">
                {group.net >= 0 ? "+" : "−"}{formatMoney(group.net)}
              </span>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {group.items.map((t) => (
                <TransactionRow
                  key={t.id}
                  type={t.type}
                  amount={t.amount}
                  description={t.description}
                  date={t.created_at}
                  riderPhotoUrl={t.rider_photo_url}
                  riderName={t.rider_name}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
