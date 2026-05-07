"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  addToSquad,
  swapSlot,
  removeFromSquad,
  type GtRole,
  type GtPhaseId,
} from "@/app/(game)/league/[leagueId]/team/gt/actions";
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
      try {
        if (mode === "fill") {
          await addToSquad({ teamId, riderId: selectedId, role, phaseId, year });
        } else if (currentRiderId) {
          await swapSlot({
            teamId,
            oldRiderId: currentRiderId,
            newRiderId: selectedId,
            phaseId,
            year,
          });
        }
        onApplied();
        onClose();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Failed to update squad");
      }
    });
  };

  const handleRemove = () => {
    if (!currentRiderId) return;
    setErr(null);
    start(async () => {
      try {
        await removeFromSquad({ teamId, riderId: currentRiderId, phaseId, year });
        onApplied();
        onClose();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Failed to remove rider");
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
                        {r.rider.real_team ?? ""}
                      </span>
                    </div>
                    <span className="shrink-0 font-[family-name:var(--font-geist-mono)] text-[length:var(--type-label)] text-[var(--text-low)]">
                      {r.rider.pcs_points_1yr ?? 0}
                    </span>
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
            onClick={onClose}
            className="px-4 py-2 text-[length:var(--type-body)] font-medium text-[var(--text-mid)] hover:text-[var(--text-high)]"
          >
            Cancel
          </button>
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
