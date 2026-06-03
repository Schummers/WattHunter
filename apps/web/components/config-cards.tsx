"use client";

import Link from "next/link";
import { Target, Globe, Users, Clock } from "lucide-react";
import { formatMoney } from "@/lib/format";

interface Strategy {
  name: string;
  value: string;
  boostPct: number;
}

interface ConfigCardsProps {
  leagueId: string;
  sponsorName: string;
  sponsorBudget: number;
  strategies: Strategy[];
  maxStrategies: number;
  isEditable: boolean;
}

const STRATEGY_ICONS: Record<string, React.ElementType> = {
  speciality: Target,
  nationality: Globe,
  teams: Users,
  age: Clock,
};

function parseStrategyType(name: string): string {
  const colon = name.indexOf(":");
  if (colon === -1) return name.toLowerCase().trim();
  return name.slice(0, colon).toLowerCase().trim();
}

function parseStrategyValue(name: string): string {
  const colon = name.indexOf(":");
  if (colon === -1) return name.trim();
  return name.slice(colon + 1).trim();
}

export function ConfigCards({
  leagueId,
  sponsorName,
  sponsorBudget,
  strategies,
  maxStrategies,
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
            <span className="font-mono">{formatMoney(sponsorBudget)}</span>/phase
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
            <span className="font-mono">{formatMoney(sponsorBudget)}</span>/phase
          </span>
        </div>
      )}

      {/* Strategies card */}
      {isEditable ? (
        <Link
          href={`/league/${leagueId}/team/strategies`}
          className="relative flex flex-1 flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-[10px] transition-colors hover:bg-[var(--bg-surface-hover)] cursor-pointer"
        >
          <span className="text-[length:var(--type-micro)] font-semibold uppercase tracking-wide text-[var(--text-low)]">
            Strategies{" "}
            <span className="font-mono text-[var(--text-mid)]">
              {strategies.length}/{maxStrategies}
            </span>
          </span>
          <StrategyList strategies={strategies} />
        </Link>
      ) : (
        <div className="relative flex flex-1 flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-[10px]">
          <span className="text-[length:var(--type-micro)] font-semibold uppercase tracking-wide text-[var(--text-low)]">
            Strategies{" "}
            <span className="font-mono text-[var(--text-mid)]">
              {strategies.length}/{maxStrategies}
            </span>
          </span>
          <StrategyList strategies={strategies} />
        </div>
      )}
    </div>
  );
}

function StrategyList({ strategies }: { strategies: Strategy[] }) {
  return (
    <div className="mt-1 flex flex-col gap-1">
      {strategies.length === 0 ? (
        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          No strategies active
        </span>
      ) : (
        strategies.map((p, i) => {
          const type = parseStrategyType(p.name);
          const value = parseStrategyValue(p.name);
          const Icon = STRATEGY_ICONS[type];
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
