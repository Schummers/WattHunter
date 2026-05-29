"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Swords, Crosshair, Zap, AlertTriangle } from "lucide-react";
import { ModalShell, ModalHeader, ModalActions } from "./tactic-modal-shell";
import { TacticCard } from "./tactic-card";
import { TACTICS, type TacticId, type TacticState } from "@/lib/tactics";
import { placeTactic } from "@/app/(game)/league/[leagueId]/team/gt/tactics/actions";
import { useDemoSafeAction } from "@/contexts/demo-context";
import type { TacticContextForFeed, TacticRival } from "@/lib/race-feed-types";
import { cn } from "@/lib/utils";

const BOOST_TACTICS = new Set<TacticId>(["unleash", "overdrive", "call_the_bus"]);
const NEMESIS_TACTICS = new Set<TacticId>(["nemesis_gc", "nemesis_sprint"]);

type Step = "select_tactic" | "confirm_boost" | "select_rival";

type Props = {
  stageSlug: string;
  stageName: string;
  tacticContext: TacticContextForFeed;
  onClose: () => void;
};

export function RaceFeedTacticModal({ stageSlug, stageName, tacticContext, onClose }: Props) {
  const { teamId, phaseId, year, activations, gcRivals, sprintRivals, myGcLeader, mySprinter } = tacticContext;
  const router = useRouter();
  const placeTacticSafe = useDemoSafeAction(placeTactic);
  const [step, setStep] = useState<Step>("select_tactic");
  const [selectedTactic, setSelectedTactic] = useState<TacticId | null>(null);
  const [selectedRivalId, setSelectedRivalId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const usageCount = (tacticId: TacticId) =>
    activations.filter((a) => a.tactic_type === tacticId).length;

  const isActiveOnStage = (tacticId: TacticId) =>
    activations.some((a) => a.tactic_type === tacticId && a.stage_slug === stageSlug);

  const getTacticState = (tacticId: TacticId, maxUses: number): TacticState => {
    if (usageCount(tacticId) >= maxUses) return "exhausted";
    if (isActiveOnStage(tacticId)) return "active_today";
    if (tacticId === "nemesis_gc" && gcRivals.length === 0) return "disabled";
    if (tacticId === "nemesis_sprint" && sprintRivals.length === 0) return "disabled";
    return "available";
  };

  const handleTacticSelect = (tacticId: TacticId) => {
    const def = TACTICS.find((t) => t.id === tacticId)!;
    if (getTacticState(tacticId, def.max) !== "available") return;
    setSelectedTactic(tacticId);
    setSelectedRivalId(null);
    setError(null);
    setStep(BOOST_TACTICS.has(tacticId) ? "confirm_boost" : "select_rival");
  };

  const activate = (extra?: { nemesisTargetTeamId: string; nemesisTargetRole: "gc_leader" | "sprinter" }) => {
    if (!selectedTactic) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await placeTacticSafe({
          teamId,
          phaseId,
          year,
          tacticType: selectedTactic,
          stageSlug,
          ...extra,
        });
        if (result && typeof result === "object" && "blocked" in result) return;
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  const rivals: TacticRival[] = selectedTactic === "nemesis_gc" ? gcRivals : sprintRivals;
  const tacticDef = selectedTactic ? TACTICS.find((t) => t.id === selectedTactic)! : null;
  const NemesisIcon = selectedTactic === "nemesis_gc" ? Swords : Crosshair;

  return (
    <ModalShell
      onClose={onClose}
      footer={
        step === "confirm_boost" ? (
          <ModalActions
            onClose={() => setStep("select_tactic")}
            onSubmit={() => activate()}
            submitLabel={isPending ? "Activating…" : "Activate"}
            submitDisabled={isPending}
          />
        ) : step === "select_rival" ? (
          <div className="flex flex-col-reverse gap-2 lg:flex-row lg:justify-end">
            <button
              type="button"
              onClick={() => setStep("select_tactic")}
              className="px-4 py-2 text-[length:var(--type-body)] font-medium text-[var(--text-mid)] hover:text-[var(--text-high)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selectedRivalId || !selectedTactic) return;
                const role = selectedTactic === "nemesis_gc" ? "gc_leader" as const : "sprinter" as const;
                activate({ nemesisTargetTeamId: selectedRivalId, nemesisTargetRole: role });
              }}
              disabled={!selectedRivalId || isPending}
              className="rounded-[var(--radius-md)] bg-[var(--accent-default)] px-4 py-2.5 text-[length:var(--type-body)] font-semibold text-[var(--bg-app)] disabled:opacity-50"
            >
              {isPending ? "Declaring..." : "Declare Nemesis"}
            </button>
          </div>
        ) : null
      }
    >
      <div className="flex flex-col gap-4 overflow-y-auto p-4">
        {step === "select_tactic" && (
          <>
            <ModalHeader
              icon={<Zap size={18} className="text-[var(--accent-default)]" />}
              title="Place a tactic"
              subtitle={stageName}
              onClose={onClose}
            />
            <div className="grid grid-cols-2 gap-2">
              {TACTICS.map((t) => (
                <TacticCard
                  key={t.id}
                  tacticId={t.id}
                  used={usageCount(t.id)}
                  state={getTacticState(t.id, t.max)}
                  disabledReason={
                    (t.id === "nemesis_gc" || t.id === "nemesis_sprint") &&
                    (t.id === "nemesis_gc" ? gcRivals : sprintRivals).length === 0
                      ? "No eligible rivals"
                      : undefined
                  }
                  onClick={() => handleTacticSelect(t.id)}
                />
              ))}
            </div>
          </>
        )}

        {step === "confirm_boost" && tacticDef && (
          <>
            <ModalHeader
              icon={<tacticDef.icon size={18} className="text-[var(--accent-default)]" />}
              title={tacticDef.name}
              subtitle={stageName}
              onClose={onClose}
            />
            <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
              {tacticDef.description}
            </p>
            {error && <p className="text-[length:var(--type-caption)] text-red-400">{error}</p>}
          </>
        )}

        {step === "select_rival" && tacticDef && NEMESIS_TACTICS.has(tacticDef.id) && (
          <>
            <ModalHeader
              icon={<NemesisIcon size={18} className="text-[var(--accent-default)]" />}
              title={tacticDef.name}
              subtitle={`1 / 1 uses left · ${stageName}`}
              subtitleMono
              onClose={onClose}
            />
            <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
              {tacticDef.description}
            </p>
            <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
              <div className="flex flex-col gap-1 text-[length:var(--type-caption)]">
                <span className="font-semibold text-[var(--text-high)]">
                  This is a duel, not a guarantee
                </span>
                <span className="text-[var(--text-mid)]">
                  <strong className="text-[var(--text-high)]">Win</strong> → you score ×2, they lose 50%. <br />
                  <strong className="text-[var(--text-high)]">Lose</strong> → you lose 25%, they gain 25%.
                </span>
              </div>
            </div>
            {(() => {
              const myLeader = selectedTactic === "nemesis_gc" ? myGcLeader : mySprinter;
              const roleLabel = selectedTactic === "nemesis_gc" ? "GC Leader" : "Sprinter";
              return myLeader ? (
                <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                      Your {roleLabel}
                    </span>
                    <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                      {myLeader.name}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums text-[var(--text-high)]">
                      {myLeader.xp}
                    </span>
                    <span className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]">
                      GT XP
                    </span>
                  </div>
                </div>
              ) : null;
            })()}
            <div className="flex min-h-0 flex-1 flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                  Rival team
                </span>
                <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">≥ your GT XP</span>
              </div>
              {rivals.length === 0 ? (
                <p className="rounded-[var(--radius-md)] bg-[var(--bg-subtle)] px-3 py-4 text-center text-[length:var(--type-caption)] text-[var(--text-mid)]">
                  No rival team has matched or exceeded your GT XP yet.
                </p>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-app)]">
                  <div className="flex flex-col">
                    {rivals.map((rival, i) => (
                      <button
                        key={rival.teamId}
                        type="button"
                        onClick={() => setSelectedRivalId(selectedRivalId === rival.teamId ? null : rival.teamId)}
                        disabled={!rival.leaderName}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
                          i !== 0 && "border-t border-[var(--border-subtle)]",
                          selectedRivalId === rival.teamId ? "bg-[var(--badge-bg)]" : "hover:bg-[var(--bg-surface-hover)]",
                          !rival.leaderName && "cursor-not-allowed opacity-50"
                        )}
                      >
                        <div
                          role="radio"
                          aria-checked={selectedRivalId === rival.teamId}
                          className={cn(
                            "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                            selectedRivalId === rival.teamId
                              ? "border-[var(--accent-default)] bg-[var(--accent-default)]"
                              : "border-[var(--border-default)] bg-transparent"
                          )}
                        >
                          {selectedRivalId === rival.teamId && (
                            <div className="size-[7px] rounded-full bg-[var(--bg-app)]" />
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                            {rival.teamName}
                          </span>
                          <span className="truncate text-[length:var(--type-caption)] text-[var(--text-mid)]">
                            {rival.leaderName ?? "No leader assigned"}
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums text-[var(--text-high)]">
                            {rival.xp}
                          </span>
                          <span className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]">
                            GT XP
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {error && <p className="text-[length:var(--type-caption)] text-[var(--danger)]">{error}</p>}
          </>
        )}
      </div>
    </ModalShell>
  );
}
