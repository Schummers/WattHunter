"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  addToSquad,
  swapSlot,
  swapSquadRoles,
  removeFromSquad,
  type GtRole,
  type GtPhaseId,
} from "@/app/(game)/league/[leagueId]/team/gt/actions";

const ROLE_LABEL: Record<GtRole, string> = {
  gc_leader: "GC Leader",
  sprinter: "Sprinter",
  climber: "Climber",
  tt_specialist: "TT Specialist",
  stage_hunter: "Stage Hunter",
  domestique: "Domestique",
};
import type { AvailableRiderEntry } from "@/app/(game)/league/[leagueId]/team/gt/gt-team-client";

interface Props {
  open: boolean;
  onClose: () => void;
  role: GtRole;
  roleLabel: string;
  roleDesc: string;
  mode: "fill" | "swap";
  currentRiderId?: string | null;
  availableRiders: AvailableRiderEntry[];
  teamId: string;
  phaseId: GtPhaseId;
  year: number;
  onApplied: () => void;
}

export function RiderPickerSheet({
  open,
  onClose,
  role,
  roleLabel,
  roleDesc,
  mode,
  currentRiderId,
  availableRiders,
  teamId,
  phaseId,
  year,
  onApplied,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const title = mode === "fill" ? `Fill ${roleLabel}` : `Swap ${roleLabel}`;

  const handleConfirm = () => {
    if (!selectedId) return;
    setErr(null);
    start(async () => {
      let result;
      if (mode === "fill") {
        result = await addToSquad({ teamId, riderId: selectedId, role, phaseId, year });
      } else if (currentRiderId) {
        const selectedEntry = availableRiders.find((r) => r.riderId === selectedId);
        if (selectedEntry?.in_squad) {
          result = await swapSquadRoles({
            teamId,
            riderAId: currentRiderId,
            roleA: role,
            riderBId: selectedId,
            roleB: selectedEntry.gt_role ?? "domestique",
            phaseId,
            year,
          });
        } else {
          result = await swapSlot({ teamId, oldRiderId: currentRiderId, newRiderId: selectedId, phaseId, year });
        }
      } else {
        result = { error: "No current rider for swap" } as const;
      }

      if ("error" in result) {
        setErr(result.error);
      } else {
        onApplied();
        onClose();
      }
    });
  };

  const handleRemove = () => {
    if (!currentRiderId) return;
    setErr(null);
    start(async () => {
      const result = await removeFromSquad({ teamId, riderId: currentRiderId, phaseId, year });
      if ("error" in result) {
        setErr(result.error);
      } else {
        onApplied();
        onClose();
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] lg:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full overflow-y-auto rounded-t-[var(--radius-lg)] bg-[var(--bg-surface)] p-4 lg:max-w-md lg:rounded-[var(--radius-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
              {title}
            </h2>
            <p className="mt-1 text-[length:var(--type-caption)] text-[var(--text-low)]">
              {roleDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-[var(--text-low)] hover:text-[var(--text-high)]"
          >
            <X size={20} />
          </button>
        </div>

        {availableRiders.length === 0 ? (
          <p className="my-6 text-center text-[length:var(--type-caption)] text-[var(--text-low)]">
            No available riders in your roster.
          </p>
        ) : (
          <ul className="my-3 flex flex-col gap-1">
            {availableRiders.map((r) => {
              if (!r.rider) return null;
              const selected = selectedId === r.riderId;
              return (
                <li key={r.riderId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.riderId)}
                    className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors ${
                      selected
                        ? "border-[var(--accent-default)] bg-[var(--accent-subtle-bg)]"
                        : "border-transparent hover:bg-[var(--bg-surface-hover)]"
                    }`}
                  >
                    <Avatar className="h-9 w-9">
                      {r.rider.photo_url && (
                        <AvatarImage
                          src={r.rider.photo_url}
                          alt={r.rider.full_name}
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <AvatarFallback>
                        {r.rider.full_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[length:var(--type-body)] font-medium text-[var(--text-high)]">
                        {r.rider.full_name}
                      </span>
                      <span className="truncate text-[length:var(--type-caption)] text-[var(--text-low)]">
                        {r.in_squad ? ROLE_LABEL[r.gt_role!] : "Not in squad"}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {err && (
          <p className="my-2 text-[length:var(--type-caption)] text-[var(--danger)]">
            {err}
          </p>
        )}

        <div className="mt-4 flex flex-col-reverse gap-2 lg:flex-row lg:justify-end">
          {mode === "swap" && currentRiderId && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={pending}
              className="px-4 py-2 text-[length:var(--type-body)] font-medium text-[var(--danger)] hover:opacity-80 disabled:opacity-50"
            >
              Remove from squad
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedId || pending}
            className="rounded-[var(--radius-md)] bg-[var(--accent-default)] px-4 py-2 font-semibold text-[var(--color-b1-1)] disabled:opacity-50"
          >
            {pending
              ? "Saving..."
              : mode === "fill"
                ? "Add to squad"
                : "Swap rider"}
          </button>
        </div>
      </div>
    </div>
  );
}
