"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Swords, Crosshair, Zap } from "lucide-react";
import { ModalShell, ModalHeader, ModalActions } from "./tactic-modal-shell";
import { TacticCard } from "./tactic-card";
import { TACTICS, type TacticId, type TacticState } from "@/lib/tactics";
import { placeTactic } from "@/app/(game)/league/[leagueId]/team/gt/tactics/actions";
import type { TacticContextForFeed, TacticRival } from "@/lib/race-feed-types";

const BOOST_TACTICS = new Set<TacticId>(["unleash", "overdrive", "call_the_bus"]);
const NEMESIS_TACTICS = new Set<TacticId>(["nemesis_gc", "nemesis_sprint"]);

type Step = "select_tactic" | "confirm_boost" | "select_rival" | "confirm_nemesis";

type Props = {
  stageSlug: string;
  stageName: string;
  tacticContext: TacticContextForFeed;
  onClose: () => void;
};

export function RaceFeedTacticModal({ stageSlug, stageName, tacticContext, onClose }: Props) {
  const { teamId, phaseId, year, activations, gcRivals, sprintRivals } = tacticContext;
  const router = useRouter();
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
        await placeTactic({
          teamId,
          phaseId,
          year,
          tacticType: selectedTactic,
          stageSlug,
          ...extra,
        });
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  const rivals: TacticRival[] = selectedTactic === "nemesis_gc" ? gcRivals : sprintRivals;
  const selectedRival = rivals.find((r) => r.teamId === selectedRivalId) ?? null;
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
          <ModalActions
            onClose={() => setStep("select_tactic")}
            onSubmit={() => { if (selectedRivalId) setStep("confirm_nemesis"); }}
            submitLabel="Next"
            submitDisabled={!selectedRivalId}
          />
        ) : step === "confirm_nemesis" ? (
          <div className="flex flex-col-reverse gap-2 lg:flex-row lg:justify-end">
            <button
              type="button"
              onClick={() => setStep("select_rival")}
              className="px-4 py-2 text-[length:var(--type-body)] font-medium text-[var(--text-mid)] hover:text-[var(--text-high)]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selectedRivalId || !selectedTactic) return;
                const role = selectedTactic === "nemesis_gc" ? "gc_leader" as const : "sprinter" as const;
                activate({ nemesisTargetTeamId: selectedRivalId, nemesisTargetRole: role });
              }}
              disabled={isPending}
              className="rounded-[var(--radius-md)] bg-[var(--accent-default)] px-4 py-2.5 text-[length:var(--type-body)] font-semibold text-[var(--bg-app)] disabled:opacity-50"
            >
              {isPending ? "Activating…" : "Activate"}
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
            <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
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
              subtitle="Select a rival team"
              onClose={onClose}
            />
            <ul className="flex flex-col gap-1.5">
              {rivals.map((rival) => (
                <li key={rival.teamId}>
                  <button
                    type="button"
                    onClick={() => setSelectedRivalId(rival.teamId)}
                    className={`w-full rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors ${
                      selectedRivalId === rival.teamId
                        ? "border-[var(--accent-default)] bg-[var(--badge-bg)]"
                        : "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]"
                    }`}
                  >
                    <div className="text-[length:var(--type-body)] font-semibold text-[var(--text-high)]">
                      {rival.teamName}
                    </div>
                    {rival.leaderName && (
                      <div className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
                        {rival.leaderName}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {step === "confirm_nemesis" && tacticDef && selectedRival && (
          <>
            <ModalHeader
              icon={<NemesisIcon size={18} className="text-[var(--accent-default)]" />}
              title={tacticDef.name}
              subtitle={stageName}
              onClose={onClose}
            />
            <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
              Activate{" "}
              <span className="font-semibold text-[var(--text-high)]">{tacticDef.name}</span>{" "}
              against{" "}
              <span className="font-semibold text-[var(--text-high)]">{selectedRival.teamName}</span>{" "}
              on{" "}
              <span className="font-semibold text-[var(--text-high)]">{stageName}</span>?
            </p>
            {error && <p className="text-[length:var(--type-caption)] text-red-400">{error}</p>}
          </>
        )}
      </div>
    </ModalShell>
  );
}
