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
import { ReleaseConfirmModal } from "@/components/release-confirm-modal";
import { computeAvailableBudget } from "@/lib/budget";

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

interface StrategyDisplay {
  slug: string;
  name: string;
  boostPct: number;
}

interface AuctionsClientProps {
  leagueId: string;
  rounds: Round[];
  activeRound: number | null;
  isRound1: boolean;
  phaseConfirmed: boolean;
  sponsorName: string;
  sponsorIncome: number;
  activeSalaries: number;
  treasury: number;
  pendingSponsorName: string | null;
  activeStrategies: StrategyDisplay[];
  maxStrategies: number;
  rosterRiders: RosterRider[];
  drafts: DraftBid[];
  maxSlots: number;
  isCommissioner: boolean;
  existingAuctionBids: { rider_id: string; amount: number }[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuctionsClient({
  leagueId,
  rounds,
  activeRound,
  isRound1,
  phaseConfirmed,
  sponsorName,
  sponsorIncome,
  activeSalaries,
  treasury,
  pendingSponsorName,
  activeStrategies,
  maxStrategies,
  rosterRiders,
  drafts: initialDrafts,
  maxSlots,
  isCommissioner,
  existingAuctionBids,
}: AuctionsClientProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftBid[]>(initialDrafts);
  const [releaseConfirm, setReleaseConfirm] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [validateSuccess, setValidateSuccess] = useState(false);
  const [, startTransition] = useTransition();

  const rosterCount = rosterRiders.length;
  const draftCount = drafts.length;
  const totalCount = rosterCount + draftCount;

  const draftBidsTotal = drafts.reduce((s, d) => s + d.amount, 0);
  const remaining = computeAvailableBudget(
    treasury,
    sponsorIncome,
    activeSalaries,
    draftBidsTotal,
    phaseConfirmed
  );
  const isDeficit = remaining < 0;

  const hasOpenRound = activeRound !== null;

  // Determine if modifications were made since last validation
  const existingMap = new Map(existingAuctionBids.map(b => [b.rider_id, b.amount]));
  let hasModifications = false;
  if (drafts.length !== existingAuctionBids.length) {
    hasModifications = true;
  } else {
    for (const d of drafts) {
      if (existingMap.get(d.riderId) !== d.amount) {
        hasModifications = true;
        break;
      }
    }
  }

  const alreadyValidatedRound = existingAuctionBids.length > 0 || validateSuccess;
  
  const validateDisabled =
    !hasOpenRound || isDeficit || totalCount > maxSlots || (alreadyValidatedRound && !hasModifications);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleRemoveDraft(riderId: string) {
    setDrafts((prev) => prev.filter((d) => d.riderId !== riderId));
    setValidateSuccess(false);
    startTransition(() => {
      removeDraft({ leagueId, riderId });
    });
  }

  function handleAmountPreview(riderId: string, newAmount: number) {
    setDrafts((prev) =>
      prev.map((d) => (d.riderId === riderId ? { ...d, amount: newAmount } : d))
    );
    setValidateSuccess(false);
  }

  async function handleAmountSave(riderId: string, newAmount: number) {
    const previousDrafts = drafts;
    setDrafts((prev) =>
      prev.map((d) => (d.riderId === riderId ? { ...d, amount: newAmount } : d))
    );
    setValidateSuccess(false);
    const result = await updateDraftAmount({ leagueId, riderId, amount: newAmount });
    if (result?.error) {
      setDrafts(previousDrafts);
    }
  }

  function handleNavigateToRider(riderId: string) {
    router.push(`/league/${leagueId}/rider/${riderId}?from=recruts`);
  }

  function handleReleaseClick(contractId: string) {
    setReleaseConfirm(contractId);
  }

  async function handleReleaseConfirm(contractId: string) {
    const result = await releaseRider(contractId);
    if (result.error) {
      const riderEntry = rosterRiders.find((r) => r.contractId === contractId);
      const riderName = riderEntry?.name ?? "This rider";
      const errorMsg = result.error === "Cannot release a rider recruited during the current phase"
        ? `${riderName} was recruited this phase and cannot be released yet. You can release them starting next phase.`
        : result.error;
      setReleaseError(errorMsg);
    } else {
      setReleaseConfirm(null);
      setReleaseError(null);
      router.refresh();
    }
  }

  async function handleValidate() {
    setValidateError(null);
    const result = await validateRound({ leagueId });
    if (result?.error) {
      setValidateError(result.error);
    } else {
      setValidateSuccess(true);
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
              href={`/league/${leagueId}/auction/rounds`}
              className="block px-4 mt-1.5 text-[length:var(--type-caption)] text-[var(--accent-default)]"
            >
              Edit round dates &rarr;
            </Link>
          )}
        </section>

        {/* Section: Sponsor & Strategies */}
        <section>
          <div className="px-4 mb-2">
            <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
              Sponsor &amp; Strategies
            </span>
          </div>
          <ConfigCards
            leagueId={leagueId}
            sponsorName={sponsorName}
            sponsorBudget={sponsorIncome}
            strategies={activeStrategies.map((p) => ({
              name: p.name,
              value: p.name,
              boostPct: p.boostPct,
            }))}
            maxStrategies={maxStrategies}
            isEditable={true}
          />
          {pendingSponsorName && !hasOpenRound && (
            <p className="text-[length:var(--type-caption)] text-[var(--accent-default)] px-4 mt-1.5 leading-snug">
              {pendingSponsorName} will be active from next auction phase.
            </p>
          )}
          <p className="text-[length:var(--type-micro)] text-[var(--text-low)] px-4 mt-1.5 leading-snug">
            {hasOpenRound
              ? "You can change sponsor and strategy during any of the 3 auction rounds."
              : "Auction closed — changes apply from the next phase."}
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
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--danger-bg)] text-red-400 transition-colors hover:bg-[var(--danger-bg)]"
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
                  onAmountChange={(newAmount) => handleAmountPreview(draft.riderId, newAmount)}
                  onAmountSave={(newAmount) => handleAmountSave(draft.riderId, newAmount)}
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
            treasury={treasury}
            sponsorIncome={sponsorIncome}
            activeSalaries={activeSalaries}
            draftBidsTotal={draftBidsTotal}
            draftCount={draftCount}
            phaseConfirmed={phaseConfirmed}
          />
        </section>

        {/* Validate error */}
        {validateError && (
          <div className="px-4">
            <p className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[length:var(--type-caption)] text-red-400">
              {validateError}
            </p>
          </div>
        )}

        {/* Validate success */}
        {validateSuccess && (
          <div className="px-4">
            <p className="rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-2 text-[length:var(--type-caption)] text-emerald-400">
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
        isDeficit={isDeficit}
        deficitMessage={isDeficit ? "Budget deficit — lower your bids to validate." : undefined}
        warningMessage={totalCount > maxSlots ? "Too many riders — remove some to validate." : undefined}
        buttonLabel={
          alreadyValidatedRound
            ? (hasModifications ? `Re-validate Round ${activeRound}` : "No modifications")
            : hasOpenRound
              ? `Validate Round ${activeRound}`
              : "No Open Round"
        }
        alwaysShow
      />

      {/* Release confirmation dialog */}
      {releaseConfirm && (() => {
        const riderEntry = rosterRiders.find((r) => r.contractId === releaseConfirm);
        return (
          <ReleaseConfirmModal
            riderName={riderEntry?.name ?? "this rider"}
            contractId={releaseConfirm}
            isPaidPhase={phaseConfirmed}
            onConfirm={handleReleaseConfirm}
            onCancel={() => { setReleaseConfirm(null); setReleaseError(null); }}
            error={releaseError}
          />
        );
      })()}
    </>
  );
}
