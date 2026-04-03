"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StickyBar } from "@/components/sticky-bar";
import { RoundBlocks } from "@/components/round-blocks";
import { ConfigCards } from "@/components/config-cards";
import { BudgetSummary } from "@/components/budget-summary";
import { DraftBidCard } from "@/components/draft-bid-card";
import { RiderCard } from "@/components/rider-card";
import { formatThousands } from "@/lib/format";
import { X } from "lucide-react";
import { removeDraft, updateDraftAmount, validateRound } from "./actions";
import { releaseRider } from "@/app/(game)/league/[leagueId]/rider/[riderId]/actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Round {
  id: string;
  round: number;
  opens_at: string;
  closes_at: string;
  status: string;
}

interface RosterRider {
  contractId: string;
  riderId: string;
  name: string;
  nationality_flag?: string;
  team_name?: string;
  pcs_rank?: number;
  pcs_rank_prev?: number;
  photo_url?: string | null;
  specialty?: string;
  lockedSalary: number;
  xp: number;
  boostPct: number;
}

interface DraftBid {
  riderId: string;
  name: string;
  nationality?: string;
  team_name?: string;
  pcs_rank?: number;
  pcs_rank_prev?: number;
  photo_url?: string | null;
  specialty?: string;
  amount: number;
  minSalary: number;
  boostPct: number;
}

interface PolicyDisplay {
  slug: string;
  name: string;
  boostPct: number;
}

interface AuctionsClientProps {
  leagueId: string;
  rounds: Round[];
  activeRound: number | null;
  isRound1: boolean;
  sponsorName: string;
  sponsorBudget: number;
  pendingSponsorName: string | null;
  activePolicies: PolicyDisplay[];
  maxPolicies: number;
  rosterRiders: RosterRider[];
  drafts: DraftBid[];
  maxSlots: number;
  isCommissioner: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuctionsClient({
  leagueId,
  rounds,
  activeRound,
  isRound1,
  sponsorName,
  sponsorBudget,
  pendingSponsorName,
  activePolicies,
  maxPolicies,
  rosterRiders,
  drafts: initialDrafts,
  maxSlots,
  isCommissioner,
}: AuctionsClientProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftBid[]>(initialDrafts);
  const [releaseConfirm, setReleaseConfirm] = useState<string | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [validateSuccess, setValidateSuccess] = useState(false);
  const [, startTransition] = useTransition();

  const rosterCount = rosterRiders.length;
  const draftCount = drafts.length;
  const totalCount = rosterCount + draftCount;

  const rosterSalaries = rosterRiders.reduce((s, r) => s + r.lockedSalary, 0);
  const draftBidsTotal = drafts.reduce((s, d) => s + d.amount, 0);
  const remaining = sponsorBudget - rosterSalaries - draftBidsTotal;
  const isDeficit = remaining < 0;

  const hasOpenRound = activeRound !== null;
  const validateDisabled =
    !hasOpenRound || isDeficit || totalCount > maxSlots || validateSuccess;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleRemoveDraft(riderId: string) {
    setDrafts((prev) => prev.filter((d) => d.riderId !== riderId));
    startTransition(() => {
      removeDraft({ leagueId, riderId });
    });
  }

  function handleAmountChange(riderId: string, newAmount: number) {
    setDrafts((prev) =>
      prev.map((d) => (d.riderId === riderId ? { ...d, amount: newAmount } : d))
    );
    startTransition(() => {
      updateDraftAmount({ leagueId, riderId, amount: newAmount });
    });
  }

  function handleNavigateToRider(riderId: string) {
    router.push(`/league/${leagueId}/rider/${riderId}?from=recruts`);
  }

  function handleReleaseClick(contractId: string) {
    setReleaseConfirm(contractId);
  }

  function handleReleaseConfirm(contractId: string) {
    setReleaseConfirm(null);
    startTransition(async () => {
      await releaseRider(contractId);
      router.refresh();
    });
  }

  async function handleValidate() {
    setValidateError(null);
    const result = await validateRound({ leagueId });
    if (result?.error) {
      setValidateError(result.error);
    } else {
      setValidateSuccess(true);
      setDrafts([]);
      router.refresh();
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <div className="py-4 space-y-6 pb-[calc(env(safe-area-inset-bottom)+56px+64px)] lg:pb-24">

        {/* Section: Rounds */}
        <section>
          <div className="flex justify-between items-center px-4 mb-2">
            <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
              Rounds
            </span>
            <Link
              href={`/league/${leagueId}/team/market/history`}
              className="text-[length:var(--type-body)] link-tertiary text-[var(--accent-default)]"
            >
              History &rarr;
            </Link>
          </div>
          {rounds.length > 0 ? (
            <RoundBlocks rounds={rounds} activeRound={activeRound} />
          ) : (
            <p className="px-4 text-[length:var(--type-body)] text-[var(--text-low)]">
              No auction rounds scheduled yet.
            </p>
          )}
          {isCommissioner && (
            <Link
              href={`/league/${leagueId}/team/auctions/rounds`}
              className="block px-4 mt-1.5 text-[length:var(--type-caption)] text-[var(--accent-default)]"
            >
              Edit round dates &rarr;
            </Link>
          )}
        </section>

        {/* Section: Sponsor & Policies */}
        <section>
          <div className="px-4 mb-2">
            <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
              Sponsor &amp; Policies
            </span>
          </div>
          <ConfigCards
            leagueId={leagueId}
            sponsorName={sponsorName}
            sponsorBudget={sponsorBudget}
            policies={activePolicies.map((p) => ({
              name: p.name,
              value: p.name,
              boostPct: p.boostPct,
            }))}
            maxPolicies={maxPolicies}
            isEditable={true}
          />
          {pendingSponsorName && !isRound1 && (
            <p className="text-[length:var(--type-caption)] text-[var(--accent-default)] px-4 mt-1.5 leading-snug">
              {pendingSponsorName} will be active from next auction phase.
            </p>
          )}
          <p className="text-[length:var(--type-micro)] text-[var(--text-low)] px-4 mt-1.5 leading-snug">
            {isRound1
              ? "Changes during Round 1 take effect immediately."
              : "Changes during Round 1 take effect immediately. After Round 1, changes apply next phase."}
          </p>
        </section>

        {/* Section: Roster */}
        <section>
          <div className="flex justify-between items-center px-4 mb-2">
            <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
              Roster
            </span>
            <span className="text-[length:var(--type-caption)] font-semibold text-[var(--text-low)]">
              <span className="font-mono">{rosterCount}/{maxSlots}</span> slots
            </span>
          </div>

          <div>
            {rosterRiders.map((rider) => (
              <div key={rider.contractId} className="relative">
                <RiderCard
                  rider={{
                    id: rider.riderId,
                    name: rider.name,
                    nationality_flag: rider.nationality_flag,
                    team_name: rider.team_name,
                    pcs_rank: rider.pcs_rank,
                    photo_url: rider.photo_url,
                  }}
                  xp={rider.xp}
                  boostPct={rider.boostPct}
                  onNavigate={() => router.push(`/league/${leagueId}/rider/${rider.riderId}?from=team`)}
                  rightContent={
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end">
                        <span className="text-[length:var(--type-body)] font-bold font-mono text-[var(--text-high)]">
                          {formatThousands(rider.lockedSalary)} €
                        </span>
                        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
                          +<span className="font-mono">{rider.xp}</span> XP
                        </span>
                      </div>
                      {(isRound1 || hasOpenRound) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handleReleaseClick(rider.contractId);
                          }}
                          aria-label="Release rider"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-red-500/[0.12] text-red-400 transition-colors hover:bg-red-500/20"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  }
                />
              </div>
            ))}

            {rosterCount === 0 && (
              <p className="px-4 py-4 text-center text-[length:var(--type-body)] text-[var(--text-low)]">
                No riders on your roster yet.
              </p>
            )}
          </div>
        </section>

        {/* Section: Draft Bids */}
        <section>
          <div className="flex justify-between items-center px-4 mb-2">
            <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
              Draft Bids
            </span>
            <span className={`text-[length:var(--type-caption)] font-semibold ${totalCount > maxSlots ? 'text-red-400' : 'text-[var(--text-low)]'}`}>
              <span className="font-mono">{totalCount}/{maxSlots}</span> slots
              {totalCount > maxSlots && <span className="font-normal"> — over limit</span>}
            </span>
          </div>

          <div>
            {drafts.length === 0 ? (
              <p className="px-4 py-4 text-center text-[length:var(--type-body)] text-[var(--text-low)]">
                No draft bids yet. Browse the Market to add riders.
              </p>
            ) : (
              drafts.map((draft) => (
                <DraftBidCard
                  key={draft.riderId}
                  rider={{
                    id: draft.riderId,
                    name: draft.name,
                    nationality: draft.nationality,
                    team_name: draft.team_name,
                    pcs_rank: draft.pcs_rank,
                    pcs_rank_prev: draft.pcs_rank_prev,
                    photo_url: draft.photo_url,
                    specialty: draft.specialty,
                  }}
                  amount={draft.amount}
                  minSalary={draft.minSalary}
                  boostPct={draft.boostPct}
                  onRemove={() => handleRemoveDraft(draft.riderId)}
                  onAmountChange={(newAmount) => handleAmountChange(draft.riderId, newAmount)}
                  onNavigate={() => handleNavigateToRider(draft.riderId)}
                />
              ))
            )}
          </div>
        </section>

        {/* Section: Summary */}
        <section className="px-4">
          <div className="mb-2">
            <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
              Summary
            </span>
          </div>
          <BudgetSummary
            sponsorIncome={sponsorBudget}
            rosterSalaries={rosterSalaries}
            rosterCount={rosterCount}
            draftBidsTotal={draftBidsTotal}
            draftCount={draftCount}
          />
        </section>

        {/* Validate error */}
        {validateError && (
          <div className="px-4">
            <p className="rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-[length:var(--type-caption)] text-red-400">
              {validateError}
            </p>
          </div>
        )}

        {/* Validate success */}
        {validateSuccess && (
          <div className="px-4">
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-2 text-[length:var(--type-caption)] text-emerald-400">
              Round validated! Your bids have been submitted.
            </p>
          </div>
        )}
      </div>

      {/* Sticky validate bar */}
      <StickyBar
        saveEnabled={!validateDisabled}
        onSave={handleValidate}
        saving={false}
        slotInfo={`${totalCount}/${maxSlots}`}
        budgetInfo={`${isDeficit ? "−" : ""}€${formatThousands(Math.abs(remaining))}`}
        isDeficit={isDeficit || totalCount > maxSlots}
        deficitMessage={
          isDeficit || totalCount > maxSlots
            ? "Remove riders or lower bids to balance your budget."
            : undefined
        }
        buttonLabel={
          validateSuccess
            ? "Round Validated"
            : hasOpenRound
              ? `Validate Round ${activeRound}`
              : "No Open Round"
        }
        alwaysShow
      />

      {/* Release confirmation dialog */}
      {releaseConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-6">
          <div className="w-full max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div>
              <p className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
                Release rider?
              </p>
              <p className="mt-1 text-[length:var(--type-body)] text-[var(--text-mid)]">
                {isRound1
                  ? "This rider will be released immediately. No salary has been charged yet — release is free."
                  : "The rider will be released immediately. The salary already paid this phase is not refunded."}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setReleaseConfirm(null)}
                className="flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface-active)] py-2.5 text-[length:var(--type-emphasis)] font-semibold text-[var(--text-mid)] transition-colors hover:bg-[var(--bg-surface-hover)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReleaseConfirm(releaseConfirm)}
                className="flex-1 rounded-[var(--radius-md)] bg-red-500/[0.15] py-2.5 text-[length:var(--type-emphasis)] font-semibold text-red-400 transition-colors hover:bg-red-500/25"
              >
                Release
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
