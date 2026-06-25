"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/segmented-control";
import { BackHeader } from "@/components/back-header";
import { StickyBar } from "@/components/sticky-bar";
import { addDraft, removeDraft } from "@/app/(game)/league/[leagueId]/auction/actions";
import { releaseRider } from "./actions";
import { useDemoSafeAction } from "@/contexts/demo-context";
import { formatThousands, formatMoney, formatXp, countryCodeToFlag } from "@/lib/format";
import { RiderPrice } from "@/components/rider-price";
import { Plus, Minus } from "lucide-react";
import { BID_INCREMENT, snapToIncrement, computeAvailableBudget } from "@/lib/budget";
import { resolvePhotoUrl } from "@/lib/photo-url";
import { ReleaseConfirmModal } from "@/components/release-confirm-modal";
import { Tag } from "@/components/pill";

type RiderContext = "market" | "team" | "ranking";

interface Rider {
  id: string;
  full_name: string;
  nationality: string | null;
  team_name: string | null;
  pcs_rank: number | null;
  pcs_points_1yr: number | null;
  photo_url: string | null;
  specialty: string | null;
  birthdate: string | null;
  height_cm: number | null;
  weight_kg: number | null;
}

interface SeasonRanking {
  rider_id: string;
  season: number;
  points: number | null;
  rank: number | null;
  team: string | null;
}

interface Startlist {
  race_name: string;
  race_date: string | null;
}

interface RaceResult {
  race_name: string;
  race_date: string | null;
  xp_gained: number | null;
  pcs_points: number | null;
  rank: number | null;
  team_id: string | null;
}

interface RiderDetailClientProps {
  leagueId: string;
  rider: Rider;
  rankings: SeasonRanking[];
  startlists: Startlist[];
  raceResults: RaceResult[];
  context: RiderContext;
  minSalary: number;
  currentBidId?: string;
  currentBidAmount: number | null;
  activeAuctionId: string | null;
  contractData: { locked_salary: number; status: string; contractId?: string; pcsPoints?: number; phaseRecruitedId?: number } | null;
  ownerInfo: { display_name: string; team_name: string; locked_salary: number | null } | null;
  budgetInfo?: {
    currentSlots: number;
    maxSlots: number;
    treasury: number;
    sponsorIncome: number;
    activeSalaries: number;
    totalDraftBidsAmount: number;
    draftBidsCount: number;
    phaseConfirmed: boolean;
  };
  inRail?: boolean;
  hideBidSection?: boolean;
  gameXp?: number;
  totalBonus?: number;
  draftAmount?: number | null;
  currentRound?: number | null;
  releaseIsPaidPhase?: boolean;
  releaseIsBlocked?: boolean;
}

function getAge(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}


const BACK_LABELS: Record<RiderContext, string> = {
  market: "Market",
  team: "My Team",
  ranking: "Ranking",
};

export function RiderDetailClient({
  leagueId,
  rider,
  rankings,
  startlists,
  raceResults,
  context,
  minSalary,
  contractData,
  ownerInfo,
  budgetInfo,
  inRail,
  hideBidSection,
  gameXp,
  totalBonus,
  draftAmount,
  releaseIsPaidPhase,
  releaseIsBlocked,
}: RiderDetailClientProps) {
  const router = useRouter();
  const addDraftSafe = useDemoSafeAction(addDraft);
  const removeDraftSafe = useDemoSafeAction(removeDraft);
  const releaseRiderSafe = useDemoSafeAction(releaseRider);
  const [tabIndex, setTabIndex] = useState(0);
  const [bidAmount, setBidAmount] = useState<number | null>(draftAmount ?? null);
  const [bidInputValue, setBidInputValue] = useState(draftAmount != null ? String(draftAmount) : "");
  const [bidInputError, setBidInputError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [releaseConfirm, setReleaseConfirm] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const bidInputRef = useRef<HTMLInputElement>(null);
  const age = getAge(rider.birthdate);

  const isInDraft = draftAmount != null;
  const isInRoster = contractData?.status === "active" && !!contractData.contractId;

  function handleBack() {
    if (context === "market") {
      router.push(`/league/${leagueId}/auction/market`);
    } else {
      router.back();
    }
  }

  async function handleAddDraft() {
    if (bidAmount === null) return;
    setSaving(true);
    setError(null);
    const result = await addDraftSafe({ leagueId, riderId: rider.id, amount: bidAmount });
    if (result && "blocked" in result) { setSaving(false); return; }
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setSaving(false);
  }

  async function handleRemoveDraft() {
    setSaving(true);
    setError(null);
    const result = await removeDraftSafe({ leagueId, riderId: rider.id });
    if (result && "blocked" in result) { setSaving(false); return; }
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setSaving(false);
  }

  function handleReleaseClick() {
    if (!contractData?.contractId) return;
    setReleaseError(null);
    setReleaseConfirm(true);
  }

  async function handleReleaseConfirm(contractId: string) {
    setSaving(true);
    setReleaseError(null);
    const result = await releaseRiderSafe(contractId);
    if (result && "blocked" in result) { setSaving(false); return; }
    if (result.error) {
      const errorMsg = result.error === "Cannot release a rider recruited during the current phase"
        ? `${rider.full_name} was recruited this phase and cannot be released yet. You can release them starting next phase.`
        : result.error;
      setReleaseError(errorMsg);
      setSaving(false);
    } else {
      setReleaseConfirm(false);
      setReleaseError(null);
      router.refresh();
      setSaving(false);
    }
  }

  // Metric boxes per context (RD-4) — value on top, label below (DS standard)
  function renderMetrics() {
    const boxClass = "flex-1 rounded-lg bg-[var(--bg-surface)] px-3 py-2.5 space-y-0.5";
    const labelClass = "text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]";
    const valueClass = "text-[length:var(--type-stat)] font-extrabold font-mono text-[var(--text-high)]";

    if (context === "market") {
      return (
        <div className="flex gap-3 px-4">
          <div className={boxClass}>
            <div className={valueClass}>
              {gameXp ? formatThousands(gameXp) : "—"}
            </div>
            <span className={labelClass}>Game XP</span>
          </div>
          <div className={boxClass}>
            <div className={valueClass}>
              {totalBonus ? formatMoney(totalBonus) : "—"}
            </div>
            <span className={labelClass}>Bonus</span>
          </div>
          <div className={boxClass}>
            <div className={valueClass}>
              <RiderPrice amount={minSalary} />
            </div>
            <span className={labelClass}>Min. Salary</span>
          </div>
        </div>
      );
    }

    if (context === "team" && contractData) {
      return (
        <div className="flex gap-3 px-4">
          <div className={boxClass}>
            <div className={valueClass}>
              {gameXp ? formatThousands(gameXp) : "—"}
            </div>
            <span className={labelClass}>Game XP</span>
          </div>
          <div className={boxClass}>
            <div className={valueClass}>
              {totalBonus ? formatMoney(totalBonus) : "—"}
            </div>
            <span className={labelClass}>Bonus</span>
          </div>
          <div className={boxClass}>
            <div className={valueClass}>
              {formatMoney(contractData.locked_salary)}
            </div>
            <span className={labelClass}>Paid Salary</span>
          </div>
        </div>
      );
    }

    // ranking: 3 boxes (Game XP, Bonus, Paid Salary from owner contract)
    return (
      <div className="flex gap-3 px-4">
        <div className={boxClass}>
          <div className={`${valueClass} !text-[var(--accent-highlight)]`}>
            {gameXp ? formatThousands(gameXp) : "—"}
          </div>
          <span className={labelClass}>Game XP</span>
        </div>
        <div className={boxClass}>
          <div className={valueClass}>
            {totalBonus ? formatMoney(totalBonus) : "—"}
          </div>
          <span className={labelClass}>Bonus</span>
        </div>
        <div className={boxClass}>
          <div className={valueClass}>
            {ownerInfo?.locked_salary != null
              ? formatMoney(ownerInfo.locked_salary)
              : "—"}
          </div>
          <span className={labelClass}>Paid Salary</span>
        </div>
      </div>
    );
  }

  // Determine if bid amount has changed from saved draft (for "Update Draft" state)
  const bidAmountChanged = isInDraft && bidAmount !== draftAmount;
  const bidInputHasValue = bidAmount !== null && bidAmount >= minSalary;

  // Sticky bar button state
  const stickyButtonLabel = (() => {
    if (saving) return isInDraft ? (bidAmountChanged ? "Updating..." : "Removing...") : "Saving...";
    if (isInRoster) return "Draft Auction";
    if (isInDraft) return bidAmountChanged ? "Update Draft" : "Draft Auction";
    return "Draft Auction";
  })();

  const stickyButtonEnabled = (() => {
    if (saving) return false;
    if (isInRoster) return false;
    if (isInDraft) return bidAmountChanged && bidInputHasValue;
    return bidInputHasValue;
  })();

  // Dynamic budget: reflect local bid changes in real time
  const currentBidDelta = (() => {
    if (!bidAmount || bidAmount < minSalary) return 0;
    if (isInDraft) return bidAmount - (draftAmount ?? 0); // delta from saved draft
    return bidAmount; // new bid, full amount added
  })();
  const dynamicBudget = budgetInfo
    ? computeAvailableBudget(
        budgetInfo.treasury,
        budgetInfo.sponsorIncome,
        budgetInfo.activeSalaries,
        budgetInfo.totalDraftBidsAmount + currentBidDelta,
        budgetInfo.phaseConfirmed
      )
    : null;

  // Dynamic slots: count draft bids + 1 if entering a NEW bid (not already in draft/roster)
  const dynamicSlots = budgetInfo
    ? budgetInfo.currentSlots + budgetInfo.draftBidsCount
      + (!isInDraft && !isInRoster && bidInputHasValue ? 1 : 0)
    : null;

  const stickyBudgetLabel =
    dynamicBudget !== null
      ? `${dynamicBudget < 0 ? "−" : ""}${formatMoney(dynamicBudget)}`
      : undefined;
  const slotLabel = dynamicSlots !== null
    ? `${dynamicSlots}/${budgetInfo!.maxSlots}`
    : undefined;

  async function handleStickyAction() {
    if (isInDraft && bidAmountChanged) {
      await handleAddDraft();
    } else if (!isInDraft) {
      await handleAddDraft();
    }
  }

  return (
    <>
    <div className={`space-y-6${!hideBidSection && !inRail ? " pb-24" : ""}`}>
      {!inRail && <BackHeader label={BACK_LABELS[context]} onBack={handleBack} />}

      {/* Hero — horizontal layout (RD-3) */}
      <div className="flex items-start gap-3 px-4">
        <div className="relative shrink-0">
          <Avatar className="size-20">
            {rider.photo_url && (
              <AvatarImage
                src={resolvePhotoUrl(rider.photo_url)}
                alt={rider.full_name}
                referrerPolicy="no-referrer"
              />
            )}
            <AvatarFallback className="bg-[var(--bg-surface)] text-[length:var(--type-body)] text-[var(--text-mid)]">
              {getInitials(rider.full_name)}
            </AvatarFallback>
          </Avatar>
          {rider.pcs_rank != null && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[length:var(--type-micro)] font-semibold font-mono text-[var(--text-mid)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full px-1.5 leading-tight">
              #{rider.pcs_rank}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)] truncate">
                {rider.full_name}
              </h1>
              {rider.nationality && (
                <span className="shrink-0">{countryCodeToFlag(rider.nationality)}</span>
              )}
            </div>
            {rider.team_name && (
              <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">{rider.team_name}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {/* D-001 à D-004: inline spans migrés vers <Tag> — text-mid intentionnel (specialty/metrics, plus saillant que text-low) */}
            {rider.specialty && (
              <Tag className="text-[var(--text-mid)]">{rider.specialty}</Tag>
            )}
            {age !== null && (
              <Tag className="font-mono text-[var(--text-mid)]">{age} yrs</Tag>
            )}
            {rider.height_cm && (
              <Tag className="font-mono text-[var(--text-mid)]">{rider.height_cm} cm</Tag>
            )}
            {rider.weight_kg && (
              <Tag className="font-mono text-[var(--text-mid)]">{rider.weight_kg} kg</Tag>
            )}
          </div>
        </div>
      </div>

      {/* Metric Boxes (RD-4) */}
      {renderMetrics()}

      {/* Action section — bid input always visible (unless hideBidSection), secondary action below */}
      {!hideBidSection && (
        <div className="px-4 space-y-3">
          {/* Bid input — always visible when not in rail */}
          {!inRail && !isInRoster && (
            <>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-10 shrink-0"
                  onClick={() => {
                    if (bidAmount !== null) {
                      const next = snapToIncrement(bidAmount - BID_INCREMENT, minSalary);
                      setBidAmount(next);
                      setBidInputValue(String(next));
                      setBidInputError(null);
                    }
                  }}
                  disabled={bidAmount === null || bidAmount <= minSalary}
                >
                  <Minus className="size-4" />
                </Button>
                <div className="flex flex-1 flex-col items-center">
                  <div className={`flex w-full items-center justify-center gap-1 h-10 px-3 rounded-md ${
                    bidInputError
                      ? "border border-[var(--danger-border)]"
                      : bidAmount !== null
                        ? "border border-[var(--accent-default)] bg-[var(--bg-surface-hover)]"
                        : "border border-[var(--border-default)] bg-transparent"
                  }`}>
                    <input
                      ref={bidInputRef}
                      type="text"
                      inputMode="numeric"
                      placeholder={formatThousands(minSalary)}
                      value={bidInputValue === (bidAmount !== null ? String(bidAmount) : "") ? (bidAmount !== null ? formatThousands(bidAmount) : "") : bidInputValue}
                      onFocus={() => setBidInputValue(bidAmount !== null ? String(bidAmount) : "")}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        setBidInputValue(raw);

                        if (raw === "") {
                          setBidAmount(null);
                          setBidInputError(null);
                          return;
                        }

                        const parsed = parseInt(raw, 10);
                        if (isNaN(parsed)) { setBidInputError(null); return; }

                        if (parsed % 1000 !== 0) {
                          setBidInputError("Must be a multiple of €1,000");
                        } else if (parsed < minSalary) {
                          setBidInputError(`Min: ${formatMoney(minSalary)}`);
                        } else {
                          setBidInputError(null);
                        }

                        const next = snapToIncrement(parsed, minSalary);
                        setBidAmount(next);
                      }}
                      onBlur={() => {
                        const parsed = parseInt(bidInputValue, 10);
                        if (isNaN(parsed) || parsed === 0) {
                          if (bidAmount === null) {
                            setBidInputValue("");
                          } else {
                            setBidInputValue(String(bidAmount));
                          }
                          setBidInputError(null);
                          return;
                        }
                        const next = snapToIncrement(parsed, minSalary);
                        setBidAmount(next);
                        setBidInputValue(String(next));
                        setBidInputError(null);
                      }}
                      className={`w-full bg-transparent text-center text-[length:var(--type-stat-small)] font-bold font-mono tabular-nums outline-none ${
                        bidInputError
                          ? "text-[var(--status-danger)]"
                          : bidAmount !== null
                            ? "text-[var(--accent-default)]"
                            : "text-[var(--text-low)]"
                      }`}
                    />
                    <span className="text-[length:var(--type-body)] text-[var(--text-ghost)]">€</span>
                  </div>
                  {/* C-001 EXCEPTION: mt-[3px] — valeur définissante sub-token (3px), pas de token --space-* à 3px. Même pattern que py-[3px] dans pill.tsx. */}
                  <span className={`mt-[3px] text-[length:var(--type-micro)] ${bidInputError ? "text-[var(--status-danger)]" : "text-[var(--text-ghost)]"}`}>
                    {bidInputError ?? <>min <RiderPrice amount={minSalary} /></>}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-10 shrink-0"
                  onClick={() => {
                    if (bidAmount === null) {
                      setBidAmount(minSalary);
                      setBidInputValue(String(minSalary));
                    } else {
                      const next = snapToIncrement(bidAmount + BID_INCREMENT, minSalary);
                      setBidAmount(next);
                      setBidInputValue(String(next));
                    }
                    setBidInputError(null);
                  }}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </>
          )}

          {/* Secondary action: Cancel Draft or Release Rider — below the bid input */}
          {!inRail && isInDraft && !isInRoster && (
            <button
              type="button"
              disabled={saving}
              onClick={handleRemoveDraft}
              className="w-full rounded-[var(--radius-md)] border border-[var(--danger-border)] text-[var(--status-danger)] py-2.5 text-[length:var(--type-body)] font-medium hover:bg-[var(--danger-bg)] transition-colors disabled:opacity-50"
            >
              {saving ? "Removing..." : "Cancel Draft"}
            </button>
          )}

          {!inRail && isInRoster && (
            <button
              type="button"
              disabled={saving}
              onClick={handleReleaseClick}
              className="w-full rounded-[var(--radius-md)] border border-[var(--danger-border)] text-[var(--status-danger)] py-2.5 text-[length:var(--type-body)] font-medium hover:bg-[var(--danger-bg)] transition-colors disabled:opacity-50"
            >
              {saving ? "Releasing..." : "Release Rider"}
            </button>
          )}

          {error && (
            <p className="text-[length:var(--type-caption)] text-[var(--status-danger)] text-center">{error}</p>
          )}
        </div>
      )}

      {/* In-rail action buttons (desktop rail — not sticky) */}
      {!hideBidSection && inRail && (
        <div className="px-4 space-y-2">
          {!isInRoster && isInDraft && (
            <>
              <Button
                variant="outline"
                size="lg"
                className="w-full border-[var(--status-danger)] text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10"
                disabled={saving}
                onClick={handleRemoveDraft}
              >
                {saving ? "Removing..." : "Cancel Draft"}
              </Button>
              {error && (
                <p className="text-[length:var(--type-caption)] text-[var(--status-danger)] text-center">{error}</p>
              )}
            </>
          )}
          {!isInRoster && !isInDraft && (
            <>
              <Button
                size="lg"
                className="w-full"
                disabled={saving || bidAmount === null || bidAmount < minSalary}
                onClick={handleAddDraft}
              >
                {saving ? "Adding..." : "Add to Draft Auction"}
              </Button>
              {error && (
                <p className="text-[length:var(--type-caption)] text-[var(--status-danger)] text-center">{error}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* RD-7: Ownership line (ranking only) */}
      {context === "ranking" && (
        <div className="px-4">
          <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            {ownerInfo
              ? `Owned by @${ownerInfo.display_name} · ${ownerInfo.team_name}`
              : "Not recruited"}
          </p>
        </div>
      )}

      {/* Segmented Control (RD-8) */}
      <div className="w-full px-4">
        <SegmentedControl
          segments={["PCS Stats", "Game Stats"]}
          activeIndex={tabIndex}
          onChange={setTabIndex}
        />
      </div>

      {/* Tab Content */}
      <div className="px-4 pb-8">
        {tabIndex === 0 ? (
          <PcsStatsSection rankings={rankings} startlists={startlists} />
        ) : (
          <GameResultsSection raceResults={raceResults} />
        )}
      </div>
    </div>

    {/* StickyBar — always shown when not in rail and not hideBidSection */}
    {!hideBidSection && !inRail && (
      <StickyBar
        saveEnabled={stickyButtonEnabled}
        onSave={handleStickyAction}
        saving={saving}
      >
        <div className="flex items-center justify-between">
          <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
            {slotLabel && stickyBudgetLabel ? (
              <>
                <span className="font-mono">{slotLabel}</span>
                {" · "}
                <span className="font-mono">{stickyBudgetLabel}</span>
              </>
            ) : slotLabel ? (
              <span className="font-mono">{slotLabel}</span>
            ) : (
              <span className="font-mono"><RiderPrice amount={minSalary} /> min</span>
            )}
          </span>
          <button
            type="button"
            onClick={handleStickyAction}
            disabled={!stickyButtonEnabled || saving}
            className="rounded-md px-4 py-1.5 text-[length:var(--type-emphasis)] font-semibold cta-gradient text-[var(--cta-text)] disabled:opacity-40"
          >
            {stickyButtonLabel}
          </button>
        </div>
      </StickyBar>
    )}

    {releaseConfirm && contractData?.contractId && (
      <ReleaseConfirmModal
        riderName={rider.full_name}
        contractId={contractData.contractId}
        isPaidPhase={releaseIsPaidPhase ?? false}
        isBlockedThisPhase={releaseIsBlocked ?? false}
        onConfirm={handleReleaseConfirm}
        onCancel={() => { setReleaseConfirm(false); setReleaseError(null); }}
        error={releaseError}
      />
    )}
    </>
  );
}

// PCS Stats section (season rankings + race programme)
function PcsStatsSection({ rankings, startlists }: { rankings: SeasonRanking[]; startlists: Startlist[] }) {
  return (
    <div className="space-y-6">
      {/* Season Rankings — flat table (RD-9) */}
      <div className="space-y-2">
        <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          Season Rankings
        </span>

        {rankings.length === 0 ? (
          <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            No season data available.
          </p>
        ) : (
          <div>
            <div className="flex items-center gap-4 px-1 py-1.5 text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
              <span className="w-12">Year</span>
              <span className="flex-1">Team</span>
              <span className="w-16 text-right">Points</span>
              <span className="w-12 text-right">Rank</span>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {rankings.map((r) => (
                <div key={r.season} className="flex items-center gap-4 px-1 py-2">
                  <span className="w-12 text-[length:var(--type-body)] font-bold font-mono text-[var(--text-high)]">
                    {r.season}
                  </span>
                  <span className="flex-1 text-[length:var(--type-body)] text-[var(--text-mid)] truncate">
                    {r.team ?? "—"}
                  </span>
                  <span className="w-16 text-right font-mono text-[length:var(--type-body)] font-bold text-[var(--text-high)]">
                    {r.points != null ? r.points.toLocaleString() : "—"}
                  </span>
                  <span className="w-12 text-right font-mono text-[length:var(--type-body)] text-[var(--text-mid)]">
                    {r.rank != null ? `#${r.rank}` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Race Programme (RD-10) */}
      {startlists.length > 0 && (
        <div className="space-y-2">
          <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Race Programme
          </span>
          <div className="divide-y divide-[var(--border-subtle)]">
            {startlists.map((s, i) => (
              <div key={i} className="flex items-baseline justify-between py-2 px-1">
                <span className="text-[length:var(--type-body)] font-normal text-[var(--text-high)] truncate min-w-0">
                  {s.race_name}
                </span>
                {s.race_date && (
                  <span className="text-[length:var(--type-body)] text-[var(--text-mid)] ml-3 shrink-0">
                    {new Date(s.race_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// RD-11: Game Results section
function GameResultsSection({ raceResults }: { raceResults: RaceResult[] }) {
  if (raceResults.length === 0) {
    return (
      <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        Game stats will be available once this rider is on a team.
      </p>
    );
  }

  // Group by month
  const grouped: Record<string, RaceResult[]> = {};
  for (const r of raceResults) {
    const date = r.race_date ? new Date(r.race_date) : null;
    const key = date
      ? date.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase()
      : "UNKNOWN";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([month, results]) => (
        <div key={month} className="space-y-1">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            {month}
          </span>
          <div className="divide-y divide-[var(--border-subtle)]">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-1">
                <div className="flex-1 min-w-0">
                  <span className="text-[length:var(--type-body)] font-semibold text-[var(--text-high)] block truncate">
                    {r.race_name}
                  </span>
                  {r.race_date && (
                    <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
                      {new Date(r.race_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.rank != null && (
                    <span className="font-mono text-[length:var(--type-caption)] text-[var(--text-low)]">
                      #{r.rank}
                    </span>
                  )}
                  {r.xp_gained != null && (
                    <span className="font-mono text-[length:var(--type-body)] font-bold text-[var(--text-high)]">
                      {formatXp(r.xp_gained)} XP
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
