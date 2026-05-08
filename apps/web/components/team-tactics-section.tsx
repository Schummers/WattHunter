"use client";
import { useState } from "react";
import { TACTICS, type TacticId, type TacticState } from "@/lib/tactics";
import type { GtStage } from "@/lib/gt-stages";
import { TacticCard } from "./tactic-card";
import { TacticBoostModal } from "./tactic-boost-modal";
import { TacticNemesisModal, type EligibleRival } from "./tactic-nemesis-modal";

export interface ActivationLite {
  tactic_type: TacticId;
  stage_slug: string;
}

interface Props {
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
  activations: ActivationLite[];
  stages: GtStage[];
  eligibleGcRivals: EligibleRival[];
  eligibleSprintRivals: EligibleRival[];
  myGcLeader: { name: string; xp: number } | null;
  mySprinter: { name: string; xp: number } | null;
}

export function TeamTacticsSection({
  teamId, phaseId, year, activations, stages,
  eligibleGcRivals, eligibleSprintRivals, myGcLeader, mySprinter,
}: Props) {
  const [open, setOpen] = useState<TacticId | null>(null);
  const todayStageSlug = stages.find((s) => s.status === "today")?.slug;

  const stateOf = (id: TacticId): { used: number; state: TacticState; reason?: string } => {
    const used = activations.filter((a) => a.tactic_type === id).length;
    const tactic = TACTICS.find((t) => t.id === id)!;
    if (used >= tactic.max) return { used, state: "exhausted" };
    const isActiveToday = todayStageSlug
      ? activations.some((a) => a.stage_slug === todayStageSlug && a.tactic_type === id)
      : false;
    if (isActiveToday) return { used, state: "active_today" };
    if (id === "nemesis_gc") {
      if (!myGcLeader) return { used, state: "disabled", reason: "Assign a GC Leader" };
      if (eligibleGcRivals.length === 0) return { used, state: "disabled", reason: "No eligible rival" };
    }
    if (id === "nemesis_sprint") {
      if (!mySprinter) return { used, state: "disabled", reason: "Assign a Sprinter" };
      if (eligibleSprintRivals.length === 0) return { used, state: "disabled", reason: "No eligible rival" };
    }
    return { used, state: "available" };
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between px-4">
        <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          Team Tactics
        </h2>
        <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          1 per day · cutoff 11:00 CET
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TACTICS.map((t) => {
          const s = stateOf(t.id);
          return (
            <TacticCard
              key={t.id}
              tacticId={t.id}
              used={s.used}
              state={s.state}
              disabledReason={s.reason}
              onClick={() => setOpen(t.id)}
            />
          );
        })}
      </div>

      {open && open !== "nemesis_gc" && open !== "nemesis_sprint" && (
        <TacticBoostModal
          tacticId={open}
          used={stateOf(open).used}
          teamId={teamId}
          phaseId={phaseId}
          year={year}
          stages={stages}
          onClose={() => setOpen(null)}
        />
      )}
      {(open === "nemesis_gc" || open === "nemesis_sprint") && (
        <TacticNemesisModal
          tacticId={open}
          used={stateOf(open).used}
          teamId={teamId}
          phaseId={phaseId}
          year={year}
          stages={stages}
          eligibleRivals={open === "nemesis_gc" ? eligibleGcRivals : eligibleSprintRivals}
          myLeader={open === "nemesis_gc" ? myGcLeader : mySprinter}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
