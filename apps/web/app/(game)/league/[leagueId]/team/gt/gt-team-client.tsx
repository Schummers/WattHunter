"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RiderCard } from "@/components/rider-card";
import { SponsorBonusCard } from "@/components/sponsor-bonus-card";
import { GtGoalsPreview } from "@/components/gt-goals-preview";
import { RoleAssignSheet } from "@/components/role-assign-sheet";
import type { GtRole } from "./actions";
import type { GtGoal } from "@/lib/gt-goals";
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

const ROLE_ORDER: Array<{
  role: GtRole;
  label: string;
  max: number | null;
  desc: string;
}> = [
  {
    role: "gc_leader",
    label: "GC Leader",
    max: 1,
    desc: "×1.5 on stage + GC points AND + top-10 GC bonus daily",
  },
  {
    role: "sprinter",
    label: "Sprinter",
    max: 1,
    desc: "×1.5 on stage + GC points AND + top-5 points bonus daily",
  },
  {
    role: "climber",
    label: "Climber",
    max: 1,
    desc: "×1.5 on stage + GC points AND + top-3 KOM bonus daily",
  },
  {
    role: "tt_specialist",
    label: "TT Specialist",
    max: 1,
    desc: "×2 on ITT stage points only",
  },
  {
    role: "stage_hunter",
    label: "Stage Hunter",
    max: 2,
    desc: "×1.5 on stage",
  },
  {
    role: "domestique",
    label: "Domestiques",
    max: null,
    desc: "No bonus multiplier. Contribute base PCS points only.",
  },
];

interface Props {
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
  gtFullName: string;
  gtShortName: string;
  squad: SquadEntry[];
  sponsor?: SponsorRow | null;
  goals: GtGoal[];
}

export function GtTeamClient({
  teamId,
  phaseId,
  year,
  gtShortName,
  squad,
  sponsor,
  goals,
}: Props) {
  const router = useRouter();
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [sheetRole, setSheetRole] = useState<Exclude<GtRole, "domestique"> | null>(null);

  const byRole = (r: GtRole) => squad.filter((s) => s.role === r);

  const sheetSquad = squad
    .filter((s) => s.rider)
    .map((s) => ({
      riderId: s.riderId,
      role: s.role,
      rider: {
        id: s.rider!.id,
        full_name: s.rider!.full_name,
        photo_url: s.rider!.photo_url ?? null,
        real_team: s.rider!.real_team ?? null,
      },
    }));

  return (
    <div className="flex flex-col gap-6 py-4 pb-24">
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
            gtGoalsPreview={<GtGoalsPreview goals={goals} />}
          />
        ) : (
          <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
            No sponsor assigned.
          </p>
        )}
      </section>

      {/* Section 2 — Team Composition */}
      <section className="flex flex-col gap-4">
        <div className="px-4">
          <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Team Composition
          </h2>
          <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
            Change a role before 11:00 CET to apply today.
          </p>
        </div>

        {ROLE_ORDER.map((block) => {
          const riders = byRole(block.role);
          const cap = block.max;
          const showOpenSlot = block.role !== "domestique" && cap != null && riders.length < cap;
          const headerCount = cap != null ? `${riders.length} / ${cap}` : `${riders.length}`;
          const isAssignable = block.role !== "domestique";

          return (
            <div key={block.role} className="flex flex-col">
              <button
                type="button"
                onClick={() =>
                  isAssignable && setSheetRole(block.role as Exclude<GtRole, "domestique">)
                }
                className="flex items-center justify-between px-4 pt-1 pb-0 text-left"
                disabled={!isAssignable}
              >
                <span className="text-[length:var(--type-label)] font-semibold uppercase tracking-wide text-[var(--text-high)]">
                  {block.label.toUpperCase()}
                </span>
                <span className="text-[length:var(--type-label)] text-[var(--text-low)]">
                  {headerCount}
                </span>
              </button>
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
                    onNavigate={
                      isAssignable
                        ? () => setSheetRole(block.role as Exclude<GtRole, "domestique">)
                        : undefined
                    }
                  />
                ) : null
              )}

              {showOpenSlot && (
                <RiderCard
                  rider={{ id: `open-${block.role}`, name: "" }}
                  isOpenSlot
                  onNavigate={() =>
                    setSheetRole(block.role as Exclude<GtRole, "domestique">)
                  }
                />
              )}
            </div>
          );
        })}
      </section>

      {sheetRole && (
        <RoleAssignSheet
          open={!!sheetRole}
          onClose={() => setSheetRole(null)}
          role={sheetRole}
          roleLabel={ROLE_ORDER.find((r) => r.role === sheetRole)!.label}
          maxPerRole={(ROLE_ORDER.find((r) => r.role === sheetRole)!.max ?? 1) as 1 | 2}
          squad={sheetSquad}
          teamId={teamId}
          phaseId={phaseId}
          year={year}
          onApplied={() => router.refresh()}
        />
      )}
    </div>
  );
}
