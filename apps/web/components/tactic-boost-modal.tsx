"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { findTactic, type TacticId } from "@/lib/tactics";
import type { GtStage } from "@/lib/gt-stages";
import { placeTactic } from "@/app/(game)/league/[leagueId]/team/gt/tactics/actions";
import { ModalShell, ModalHeader, ModalActions } from "./tactic-modal-shell";
import { StageList } from "./tactic-stage-list";

interface Props {
  tacticId: Exclude<TacticId, "nemesis_gc" | "nemesis_sprint">;
  used: number;
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
  stages: GtStage[];
  onClose: () => void;
}

export function TacticBoostModal({
  tacticId,
  used,
  teamId,
  phaseId,
  year,
  stages,
  onClose,
}: Props) {
  const tactic = findTactic(tacticId);
  const Icon = tactic.icon;
  const remaining = tactic.max - used;
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = () => {
    if (!selectedStage) return;
    setErr(null);
    startTransition(async () => {
      try {
        await placeTactic({
          teamId,
          phaseId,
          year,
          tacticType: tacticId,
          stageSlug: selectedStage,
        });
        router.refresh();
        onClose();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  return (
    <ModalShell
      onClose={onClose}
      footer={
        <ModalActions
          onClose={onClose}
          onSubmit={handleSubmit}
          submitLabel={pending ? "Activating..." : "Activate"}
          submitDisabled={!selectedStage || pending}
        />
      }
    >
      <div className="flex h-full flex-col gap-4 p-4">
        <ModalHeader
          icon={<Icon className="size-5 text-[var(--accent-default)]" />}
          title={tactic.name}
          subtitle={`${remaining} / ${tactic.max} uses left`}
          subtitleMono
          onClose={onClose}
        />
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          {tactic.description}
        </p>
        <div className="flex flex-1 flex-col gap-2 min-h-0">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            Target stage
          </span>
          <StageList
            stages={stages}
            value={selectedStage}
            onChange={setSelectedStage}
            fillParent
          />
        </div>
        {err && (
          <p className="text-[length:var(--type-caption)] text-[var(--danger)]">{err}</p>
        )}
      </div>
    </ModalShell>
  );
}
