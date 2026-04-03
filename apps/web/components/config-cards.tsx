"use client";

import Link from "next/link";
import { formatThousands } from "@/lib/format";

interface Policy {
  name: string;
  value: string;
  boostPct: number;
}

interface ConfigCardsProps {
  leagueId: string;
  sponsorName: string;
  sponsorBudget: number;
  policies: Policy[];
  maxPolicies: number;
  isEditable: boolean;
}

export function ConfigCards({
  leagueId,
  sponsorName,
  sponsorBudget,
  policies,
  maxPolicies,
  isEditable,
}: ConfigCardsProps) {
  return (
    <div className="flex gap-2 px-4">
      {/* Sponsor card */}
      <div className="relative flex flex-1 flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-[10px]">
        {isEditable && (
          <Link
            href={`/league/${leagueId}/budget/marketplace`}
            className="absolute right-[10px] top-[10px] text-[length:var(--type-micro)] font-semibold text-[var(--accent-default)] hover:text-[var(--accent-highlight)] transition-colors"
          >
            Change →
          </Link>
        )}
        <span className="text-[length:var(--type-micro)] font-semibold uppercase tracking-wide text-[var(--text-low)]">
          Sponsor
        </span>
        <span className="mt-1 text-[length:var(--type-caption)] font-medium leading-snug text-[var(--text-high)]">
          {sponsorName}
        </span>
        <span className="mt-0.5 text-[length:var(--type-micro)] text-[var(--text-mid)]">
          <span className="font-mono">€{formatThousands(sponsorBudget)}</span>/phase
        </span>
      </div>

      {/* Policies card */}
      <div className="relative flex flex-1 flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-[10px]">
        {isEditable && (
          <Link
            href={`/league/${leagueId}/team/policies`}
            className="absolute right-[10px] top-[10px] text-[length:var(--type-micro)] font-semibold text-[var(--accent-default)] hover:text-[var(--accent-highlight)] transition-colors"
          >
            Change →
          </Link>
        )}
        <span className="text-[length:var(--type-micro)] font-semibold uppercase tracking-wide text-[var(--text-low)]">
          Policies{" "}
          <span className="font-mono text-[var(--text-mid)]">
            {policies.length}/{maxPolicies}
          </span>
        </span>
        <div className="mt-1 flex flex-col gap-1">
          {policies.length === 0 ? (
            <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">
              No policies active
            </span>
          ) : (
            policies.map((p, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-high)]">
                  {p.name}
                </span>
                {p.boostPct > 0 && (
                  <span className="rounded-[var(--radius-pill)] bg-[var(--badge-bg)] px-[5px] py-px text-[length:var(--type-micro)] font-semibold text-[var(--accent-highlight)]">
                    +<span className="font-mono">{p.boostPct}</span>%
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
