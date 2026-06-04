"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RiderCard } from "@/components/rider-card";
import { SponsorBonusCard } from "@/components/sponsor-bonus-card";
import { RiderPickerSheet } from "@/components/rider-picker-sheet";
import { TeamTacticsSection, type ActivationLite } from "@/components/team-tactics-section";
import { NemesisIncomingBanner, type IncomingNemesis } from "@/components/nemesis-incoming-banner";
import type { EligibleRival } from "@/components/tactic-nemesis-modal";
import type { GtStage } from "@/lib/gt-stages";
import type { GtRole } from "./actions";
import type { SponsorRow } from "@/lib/sponsors";
import { countryCodeToFlag } from "@/lib/format";

interface SquadEntry {
  riderId: string;
  role: GtRole;
  xp: number;
  rider: {
    id: string;
    full_name: string;
    nationality?: string | null;
    real_team?: string | null;
    pcs_rank?: number | null;
    photo_url?: string | null;
  } | null;
}

export interface AvailableRiderEntry {
  riderId: string;
  gt_role: GtRole | null;
  in_squad: boolean;
  rider: {
    id: string;
    full_name: string;
    nationality?: string | null;
    real_team?: string | null;
    pcs_rank?: number | null;
    photo_url?: string | null;
    pcs_points_1yr?: number | null;
  } | null;
}

const ROLE_ORDER: Array<{
  role: GtRole;
  label: string;
  max: number;
  desc: string;
}> = [
  {
    role: "gc_leader",
    label: "GC Leader",
    max: 1,
    desc: "×1.5 stage points · ×1.5 final GC points · top 10 GC daily bonus",
  },
  {
    role: "sprinter",
    label: "Sprinter",
    max: 1,
    desc: "×1.5 stage points · ×1.5 final points classif · top 5 points daily bonus",
  },
  {
    role: "climber",
    label: "Climber",
    max: 1,
    desc: "×1.5 stage points · ×1.5 final KOM classif · top 3 KOM daily bonus",
  },
  {
    role: "tt_specialist",
    label: "TT Specialist",
    max: 1,
    desc: "×2 on ITT stages only",
  },
  {
    role: "stage_hunter",
    label: "Stage Hunter",
    max: 2,
    desc: "×1.5 on stage points only",
  },
  {
    role: "domestique",
    label: "Domestiques",
    max: 2,
    desc: "No stage bonus or daily bonus. Base PCS points only.",
  },
  {
    role: "underdog",
    label: "Underdog",
    max: 2,
    desc: "Eligible teams only. Stage points ×(PCS rank ÷ 100), capped ×4. No bonus on final classifications.",
  },
];

interface Props {
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
  underdogEligible: boolean;
  raceTeamLabel: string;
  squad: SquadEntry[];
  availableRiders: AvailableRiderEntry[];
  sponsor?: SponsorRow | null;
  completedGoalIndices?: number[];
  activations: ActivationLite[];
  stages: GtStage[];
  eligibleGcRivals: EligibleRival[];
  eligibleSprintRivals: EligibleRival[];
  myGcLeader: { name: string; xp: number } | null;
  mySprinter: { name: string; xp: number } | null;
  incomingNemesis: IncomingNemesis[];
}

export function GtTeamClient({
  teamId,
  phaseId,
  year,
  underdogEligible,
  raceTeamLabel,
  squad,
  availableRiders,
  sponsor,
  completedGoalIndices,
  activations,
  stages,
  eligibleGcRivals,
  eligibleSprintRivals,
  myGcLeader,
  mySprinter,
  incomingNemesis,
}: Props) {
  const router = useRouter();
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [sheetRole, setSheetRole] = useState<GtRole | null>(null);
  const [sheetMode, setSheetMode] = useState<"fill" | "swap">("fill");
  const [sheetCurrentRiderId, setSheetCurrentRiderId] = useState<string | null>(null);

  const byRole = (r: GtRole) => squad.filter((s) => s.role === r);

  const openFillSheet = (role: GtRole) => {
    setSheetRole(role);
    setSheetMode("fill");
    setSheetCurrentRiderId(null);
  };

  const openSwapSheet = (role: GtRole, riderId: string) => {
    setSheetRole(role);
    setSheetMode("swap");
    setSheetCurrentRiderId(riderId);
  };

  const gtShortName = raceTeamLabel.includes("Giro")
    ? "Giro"
    : raceTeamLabel.includes("Tour")
      ? "Tour"
      : "Vuelta";

  return (
    <div className="flex flex-col gap-6 py-4 pb-24">
      {/* Banner at top — auto-hides when no incomings */}
      <NemesisIncomingBanner incomings={incomingNemesis} />

      {/* Section 1 — Sponsors Goals */}
      <section className="px-4">
        <h2 className="mb-3 text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          Sponsors Goals
        </h2>
        {sponsor ? (
          <SponsorBonusCard
            sponsor={sponsor}
            expanded={sponsorOpen}
            onToggle={() => setSponsorOpen((v) => !v)}
            completedGoalIndices={completedGoalIndices}
          />
        ) : (
          <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
            No sponsor assigned.
          </p>
        )}
      </section>

      {/* NEW: Team Tactics — between Sponsors and Composition */}
      <TeamTacticsSection
        teamId={teamId}
        phaseId={phaseId}
        year={year}
        activations={activations}
        stages={stages}
        eligibleGcRivals={eligibleGcRivals}
        eligibleSprintRivals={eligibleSprintRivals}
        myGcLeader={myGcLeader}
        mySprinter={mySprinter}
      />

      {/* Section 2 — Team Composition */}
      <section className="flex flex-col gap-4">
        <div className="px-4">
          <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Team Composition for {gtShortName}
          </h2>
          <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
            Change a role before 11:00 CET to apply today.
          </p>
        </div>

        {ROLE_ORDER.filter((r) => r.role !== "underdog" || underdogEligible).map((block) => {
          const riders = byRole(block.role);
          const cap = block.max;
          const showOpenSlots = riders.length < cap;
          const openSlotCount = cap - riders.length;
          const headerCount = `${riders.length} / ${cap}`;

          return (
            <div key={block.role} className="flex flex-col">
              <div className="flex items-center justify-between px-4 pt-1 pb-0">
                <span className="text-[length:var(--type-label)] font-semibold uppercase tracking-wide text-[var(--text-high)]">
                  {block.label.toUpperCase()}
                </span>
                <span className="text-[length:var(--type-label)] text-[var(--text-low)]">
                  {headerCount}
                </span>
              </div>
              <p className="mb-1 px-4 text-[length:var(--type-micro)] text-[var(--text-low)]">
                {block.desc}
              </p>

              {riders.map((r) =>
                r.rider ? (
                  <RiderCard
                    key={r.riderId}
                    rider={{
                      id: r.riderId,
                      name: r.rider.full_name,
                      team_name: r.rider.real_team ?? undefined,
                      pcs_rank: r.rider.pcs_rank ?? undefined,
                      nationality_flag: r.rider.nationality
                        ? countryCodeToFlag(r.rider.nationality)
                        : undefined,
                      photo_url: r.rider.photo_url ?? null,
                    }}
                    xp={r.xp}
                    onNavigate={() => openSwapSheet(block.role, r.riderId)}
                  />
                ) : null
              )}

              {showOpenSlots &&
                Array.from({ length: openSlotCount }).map((_, i) => (
                  <RiderCard
                    key={`open-${block.role}-${i}`}
                    rider={{ id: `open-${block.role}-${i}`, name: "" }}
                    isOpenSlot
                    onNavigate={() => openFillSheet(block.role)}
                  />
                ))}
            </div>
          );
        })}
      </section>

      {sheetRole && (
        <RiderPickerSheet
          open={!!sheetRole}
          onClose={() => setSheetRole(null)}
          role={sheetRole}
          roleLabel={ROLE_ORDER.find((r) => r.role === sheetRole)!.label}
          roleDesc={ROLE_ORDER.find((r) => r.role === sheetRole)!.desc}
          mode={sheetMode}
          currentRiderId={sheetCurrentRiderId}
          availableRiders={availableRiders.filter((r) => r.riderId !== sheetCurrentRiderId)}
          teamId={teamId}
          phaseId={phaseId}
          year={year}
          onApplied={() => router.refresh()}
        />
      )}
    </div>
  );
}
