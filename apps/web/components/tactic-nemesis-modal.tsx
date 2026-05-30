"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Swords } from "lucide-react";
import { findTactic } from "@/lib/tactics";
import type { GtStage } from "@/lib/gt-stages";
import { placeTactic } from "@/app/(game)/league/[leagueId]/team/gt/tactics/actions";
import { useDemoSafeAction } from "@/contexts/demo-context";
import { ModalShell, ModalHeader } from "./tactic-modal-shell";
import { StageList } from "./tactic-stage-list";
import { cn } from "@/lib/utils";
import { formatXp } from "@/lib/format";

export interface EligibleRival {
  teamId: string;
  teamName: string;
  leader: { riderId: string; name: string } | null;
  xp: number;
}

interface Props {
  tacticId: "nemesis_gc" | "nemesis_sprint";
  used: number;
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
  stages: GtStage[];
  eligibleRivals: EligibleRival[];
  myLeader: { name: string; xp: number } | null;
  onClose: () => void;
}

export function TacticNemesisModal({
  tacticId, used, teamId, phaseId, year, stages, eligibleRivals, myLeader, onClose,
}: Props) {
  const tactic = findTactic(tacticId);
  const Icon = tactic.icon;
  const remaining = tactic.max - used;
  const isGc = tacticId === "nemesis_gc";
  const roleLabel = isGc ? "GC Leader" : "Sprinter";

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRival, setSelectedRival] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const placeTacticSafe = useDemoSafeAction(placeTactic);

  const rival = eligibleRivals.find((r) => r.teamId === selectedRival);

  const declare = () => {
    if (!selectedRival || !selectedStage) return;
    setErr(null);
    startTransition(async () => {
      try {
        const result = await placeTacticSafe({
          teamId, phaseId, year,
          tacticType: tacticId,
          stageSlug: selectedStage,
          nemesisTargetTeamId: selectedRival,
          nemesisTargetRole: isGc ? "gc_leader" : "sprinter",
        });
        if (result && typeof result === "object" && "blocked" in result) return;
        router.refresh();
        onClose();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  if (step === 1) {
    return (
      <ModalShell
        onClose={onClose}
        footer={
          <div className="flex flex-col-reverse gap-2 lg:flex-row lg:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[length:var(--type-body)] font-medium text-[var(--text-mid)] hover:text-[var(--text-high)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!selectedRival}
              className="rounded-[var(--radius-md)] bg-[var(--accent-default)] px-4 py-2.5 text-[length:var(--type-body)] font-semibold text-[var(--bg-app)] disabled:opacity-50"
            >
              Next
            </button>
          </div>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <ModalHeader
            icon={<Icon className="size-5 text-[var(--accent-default)]" />}
            title={tactic.name}
            subtitle={`${remaining} / ${tactic.max} uses left · Step 1 of 2`}
            subtitleMono
            onClose={onClose}
          />
          <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            {tactic.description}
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
          {myLeader && (
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
                  {formatXp(myLeader.xp)}
                </span>
                <span className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]">
                  GT XP
                </span>
              </div>
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                Rival team
              </span>
              <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">
                ≥ your GT XP
              </span>
            </div>
            {eligibleRivals.length === 0 ? (
              <p className="rounded-[var(--radius-md)] bg-[var(--bg-subtle)] px-3 py-4 text-center text-[length:var(--type-caption)] text-[var(--text-mid)]">
                No rival team has matched or exceeded your GT XP yet.
              </p>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-app)]">
                <div className="flex flex-col">
                  {eligibleRivals.map((r, i) => (
                    <RivalRow
                      key={r.teamId}
                      rival={r}
                      isSelected={selectedRival === r.teamId}
                      isFirst={i === 0}
                      onSelect={() => setSelectedRival(selectedRival === r.teamId ? null : r.teamId)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </ModalShell>
    );
  }

  // Step 2
  return (
    <ModalShell
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 lg:flex-row lg:justify-between">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-[length:var(--type-body)] font-medium text-[var(--text-mid)] hover:text-[var(--text-high)]"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
          <button
            type="button"
            onClick={declare}
            disabled={!selectedStage || pending}
            className="rounded-[var(--radius-md)] bg-[var(--accent-default)] px-4 py-2.5 text-[length:var(--type-body)] font-semibold text-[var(--bg-app)] disabled:opacity-50"
          >
            {pending ? "Declaring..." : "Declare Nemesis"}
          </button>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <ModalHeader
          icon={<Icon className="size-5 text-[var(--accent-default)]" />}
          title={tactic.name}
          subtitle={`${remaining} / ${tactic.max} uses left · Step 2 of 2`}
          subtitleMono
          onClose={onClose}
        />
        <div className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--accent-default)] bg-[var(--badge-bg)] px-3 py-2.5">
          <Swords className="size-4 shrink-0 text-[var(--accent-default)]" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
              Target
            </span>
            <span className="truncate text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
              {rival?.teamName}
              {rival?.leader && (
                <span className="font-normal text-[var(--text-mid)]">
                  {" "}· {rival.leader.name}
                </span>
              )}
            </span>
          </div>
          <span className="font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums text-[var(--text-high)]">
            {rival?.xp}
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            Target stage
          </span>
          <StageList stages={stages} value={selectedStage} onChange={setSelectedStage} fillParent />
        </div>
        {err && (
          <p className="text-[length:var(--type-caption)] text-[var(--danger)]">{err}</p>
        )}
      </div>
    </ModalShell>
  );
}

function RivalRow({
  rival,
  isSelected,
  isFirst,
  onSelect,
}: {
  rival: EligibleRival;
  isSelected: boolean;
  isFirst: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!rival.leader}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
        !isFirst && "border-t border-[var(--border-subtle)]",
        isSelected ? "bg-[var(--badge-bg)]" : "hover:bg-[var(--bg-surface-hover)]",
        !rival.leader && "cursor-not-allowed opacity-50"
      )}
    >
      <div
        role="radio"
        aria-checked={isSelected}
        className={cn(
          "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          isSelected
            ? "border-[var(--accent-default)] bg-[var(--accent-default)]"
            : "border-[var(--border-default)] bg-transparent"
        )}
      >
        {isSelected && <div className="size-[7px] rounded-full bg-[var(--bg-app)]" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
          {rival.teamName}
        </span>
        <span className="truncate text-[length:var(--type-caption)] text-[var(--text-mid)]">
          {rival.leader?.name ?? "No leader assigned"}
        </span>
      </div>
      <div className="flex flex-col items-end">
        <span className="font-mono text-[length:var(--type-stat-small)] font-bold tabular-nums text-[var(--text-high)]">
          {formatXp(rival.xp)}
        </span>
        <span className="text-[length:var(--type-micro)] uppercase tracking-wide text-[var(--text-low)]">
          GT XP
        </span>
      </div>
    </button>
  );
}
