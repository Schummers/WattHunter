"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatEuro, formatThousands, smartCountdown } from "@/lib/format";
import { confirmPhaseSetup } from "./actions";

interface RosterRider {
  contractId: string;
  riderId: string;
  fullName: string;
  lockedSalary: number;
}

interface PhaseSetupProps {
  leagueId: string;
  teamId: string;
  phase: { id: number; label: string };
  phaseStarted: boolean;
  phaseStartDate: string;
  sponsor: { name: string; monthlyBudget: number } | null;
  pendingSponsor: { name: string } | null;
  roster: RosterRider[];
  activePolicies: Array<{ id: string; name: string; config: string }>;
  maxPolicies: number;
  treasury: number;
  rounds: Array<{ name: string; date: string }>;
}

export function PhaseSetup({
  leagueId,
  teamId,
  phase,
  phaseStarted,
  phaseStartDate,
  sponsor,
  pendingSponsor,
  roster,
  activePolicies,
  maxPolicies,
  treasury,
  rounds,
}: PhaseSetupProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalSalary = roster.reduce((sum, r) => sum + r.lockedSalary, 0);
  const sponsorBudget = sponsor?.monthlyBudget ?? 0;
  const treasuryAfter = treasury + sponsorBudget - totalSalary;

  async function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmPhaseSetup(teamId);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5 px-4 pt-4 pb-24">
      {/* Phase header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[length:var(--type-title)] font-bold text-[var(--text-high)]">
            Phase {phase.id} — {phase.label}
          </h2>
        </div>
        {!phaseStarted && (
          <span className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            Starts {smartCountdown(phaseStartDate)}
          </span>
        )}
      </div>

      {/* Round dates */}
      {rounds.length > 0 && (
        <div>
          <h3 className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] mb-1">
            Rounds
          </h3>
          <div className="flex gap-3 text-[length:var(--type-body)] text-[var(--text-mid)]">
            {rounds.map((r, i) => (
              <span key={i}>
                R{i + 1}: {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            ))}
          </div>
        </div>
      )}

      <hr className="border-[var(--border-subtle)]" />

      {/* Sponsor */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] mb-0.5">
            Sponsor
          </h3>
          <p className="text-[length:var(--type-body)] text-[var(--text-high)]">
            {sponsor?.name ?? "None"}{" "}
            {pendingSponsor && (
              <span className="text-[var(--text-mid)]">
                → {pendingSponsor.name} next phase
              </span>
            )}
          </p>
          <p className="text-[length:var(--type-caption)] text-[var(--text-mid)] font-mono">
            +{formatThousands(sponsorBudget)} €
          </p>
        </div>
        <Link
          href={`/league/${leagueId}/budget`}
          className="text-[length:var(--type-body)] text-[var(--accent-default)]"
        >
          Change
        </Link>
      </div>

      <hr className="border-[var(--border-subtle)]" />

      {/* Roster */}
      <div>
        <h3 className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] mb-2">
          My Roster ({roster.length} riders)
        </h3>
        <div className="space-y-1">
          {roster.map((r) => (
            <div
              key={r.contractId}
              className="flex items-center justify-between py-1.5"
            >
              <Link
                href={`/league/${leagueId}/rider/${r.riderId}?from=team`}
                className="text-[length:var(--type-body)] text-[var(--text-high)]"
              >
                {r.fullName}
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-[length:var(--type-body)] text-[var(--text-mid)] font-mono">
                  {formatThousands(r.lockedSalary)} €
                </span>
                <Link
                  href={`/league/${leagueId}/rider/${r.riderId}?from=team`}
                  className="text-[length:var(--type-caption)] text-[var(--status-danger)]"
                >
                  Release
                </Link>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[length:var(--type-body)] text-[var(--text-mid)] font-mono">
          Total salaries: -{formatThousands(totalSalary)} €
        </p>
      </div>

      <hr className="border-[var(--border-subtle)]" />

      {/* Policies */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] mb-1">
            Policies ({activePolicies.length}/{maxPolicies} active)
          </h3>
          {activePolicies.map((p) => (
            <p key={p.id} className="text-[length:var(--type-body)] text-[var(--text-mid)]">
              {p.name}: {p.config}
            </p>
          ))}
          {activePolicies.length === 0 && (
            <p className="text-[length:var(--type-body)] text-[var(--text-ghost)]">
              No active policies
            </p>
          )}
        </div>
        <Link
          href={`/league/${leagueId}/team/policies`}
          className="text-[length:var(--type-body)] text-[var(--accent-default)]"
        >
          Change
        </Link>
      </div>

      <hr className="border-[var(--border-subtle)]" />

      {/* Forecast */}
      <div>
        <h3 className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] mb-2">
          Forecast
        </h3>
        <div className="space-y-1 text-[length:var(--type-body)] font-mono">
          <div className="flex justify-between">
            <span className="text-[var(--text-mid)]">Treasury now</span>
            <span className="text-[var(--text-high)]">{formatEuro(treasury)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-mid)]">+ Sponsor</span>
            <span className="text-[var(--accent-default)]">+{formatEuro(sponsorBudget)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-mid)]">- Salaries</span>
            <span className="text-[var(--status-danger)]">-{formatEuro(totalSalary)}</span>
          </div>
          <hr className="border-[var(--border-subtle)]" />
          <div className="flex justify-between font-bold">
            <span className="text-[var(--text-high)]">After payday</span>
            <span className={treasuryAfter >= 0 ? "text-[var(--text-high)]" : "text-[var(--status-danger)]"}>
              {formatEuro(treasuryAfter)}
            </span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-[length:var(--type-body)] text-[var(--status-danger)]">{error}</p>
      )}

      {/* Confirm button */}
      <Button
        onClick={handleConfirm}
        disabled={!phaseStarted || isPending}
        className="w-full"
        size="lg"
      >
        {isPending
          ? "Confirming..."
          : phaseStarted
            ? "Confirm & Start Bidding"
            : `Phase starts ${new Date(phaseStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
      </Button>
    </div>
  );
}
