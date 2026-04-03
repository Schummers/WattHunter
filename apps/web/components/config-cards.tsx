"use client";

import Link from "next/link";
import { Target, Globe, Users, Clock } from "lucide-react";
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

const POLICY_ICONS: Record<string, React.ElementType> = {
  speciality: Target,
  nationality: Globe,
  teams: Users,
  age: Clock,
};

function parsePolicyType(name: string): string {
  const colon = name.indexOf(":");
  if (colon === -1) return name.toLowerCase().trim();
  return name.slice(0, colon).toLowerCase().trim();
}

function parsePolicyValue(name: string): string {
  const colon = name.indexOf(":");
  if (colon === -1) return name.trim();
  return name.slice(colon + 1).trim();
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
      {isEditable ? (
        <Link
          href={`/league/${leagueId}/budget/marketplace?from=auctions`}
          className="relative flex flex-1 flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-[10px] transition-colors hover:bg-[var(--bg-surface-hover)] cursor-pointer"
        >
          <span className="text-[length:var(--type-micro)] font-semibold uppercase tracking-wide text-[var(--text-low)]">
            Sponsor
          </span>
          <span className="mt-1 text-[length:var(--type-caption)] font-medium leading-snug text-[var(--text-high)]">
            {sponsorName}
          </span>
          <span className="mt-0.5 text-[length:var(--type-caption)] text-[var(--text-mid)]">
            <span className="font-mono">€{formatThousands(sponsorBudget)}</span>/phase
          </span>
        </Link>
      ) : (
        <div className="relative flex flex-1 flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-[10px]">
          <span className="text-[length:var(--type-micro)] font-semibold uppercase tracking-wide text-[var(--text-low)]">
            Sponsor
          </span>
          <span className="mt-1 text-[length:var(--type-caption)] font-medium leading-snug text-[var(--text-high)]">
            {sponsorName}
          </span>
          <span className="mt-0.5 text-[length:var(--type-caption)] text-[var(--text-mid)]">
            <span className="font-mono">€{formatThousands(sponsorBudget)}</span>/phase
          </span>
        </div>
      )}

      {/* Policies card */}
      {isEditable ? (
        <Link
          href={`/league/${leagueId}/team/policies`}
          className="relative flex flex-1 flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-[10px] transition-colors hover:bg-[var(--bg-surface-hover)] cursor-pointer"
        >
          <span className="text-[length:var(--type-micro)] font-semibold uppercase tracking-wide text-[var(--text-low)]">
            Policies{" "}
            <span className="font-mono text-[var(--text-mid)]">
              {policies.length}/{maxPolicies}
            </span>
          </span>
          <PolicyList policies={policies} />
        </Link>
      ) : (
        <div className="relative flex flex-1 flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-[10px]">
          <span className="text-[length:var(--type-micro)] font-semibold uppercase tracking-wide text-[var(--text-low)]">
            Policies{" "}
            <span className="font-mono text-[var(--text-mid)]">
              {policies.length}/{maxPolicies}
            </span>
          </span>
          <PolicyList policies={policies} />
        </div>
      )}
    </div>
  );
}

function PolicyList({ policies }: { policies: Policy[] }) {
  return (
    <div className="mt-1 flex flex-col gap-1">
      {policies.length === 0 ? (
        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          No policies active
        </span>
      ) : (
        policies.map((p, i) => {
          const type = parsePolicyType(p.name);
          const value = parsePolicyValue(p.name);
          const Icon = POLICY_ICONS[type];
          return (
            <div key={i} className="flex items-center gap-1">
              {Icon && (
                <Icon
                  size={12}
                  className="shrink-0 text-[var(--text-mid)]"
                  aria-hidden
                />
              )}
              <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-high)]">
                {value}
              </span>
              {p.boostPct > 0 && (
                <span className="rounded-[var(--radius-pill)] bg-[var(--badge-bg)] px-[5px] py-px text-[length:var(--type-micro)] font-semibold text-[var(--accent-highlight)]">
                  +<span className="font-mono">{p.boostPct}</span>%
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
