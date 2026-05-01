"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { assignRole, type GtRole } from "@/app/(game)/league/[leagueId]/team/gt/actions";

export interface SquadRider {
  riderId: string;
  role: GtRole;
  rider: {
    id: string;
    full_name: string;
    photo_url?: string | null;
    real_team?: string | null;
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  role: Exclude<GtRole, "domestique">;
  roleLabel: string;
  maxPerRole: 1 | 2;
  squad: SquadRider[];
  teamId: string;
  phaseId: 4 | 6 | 8;
  year: number;
  onApplied: () => void;
}

export function RoleAssignSheet({
  open,
  onClose,
  role,
  roleLabel,
  maxPerRole,
  squad,
  teamId,
  phaseId,
  year,
  onApplied,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const subtitle =
    maxPerRole === 1
      ? "Only 1 rider for this role. Selecting a rider with another role will swap roles."
      : "Up to 2 riders. Selecting a rider with another role will swap roles.";

  const handleApply = () => {
    if (!selectedId) return;
    setErr(null);
    start(async () => {
      try {
        await assignRole({ teamId, riderId: selectedId, role, phaseId, year });
        onApplied();
        onClose();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Failed to assign role");
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
              Assign {roleLabel}
            </h2>
            <p className="mt-1 text-[length:var(--type-caption)] text-[var(--text-low)]">
              {subtitle}
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

        <ul className="my-3 flex flex-col gap-1">
          {squad.map((s) => {
            const selected = selectedId === s.riderId;
            return (
              <li key={s.riderId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.riderId)}
                  className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors ${
                    selected
                      ? "border-[var(--accent-default)] bg-[var(--accent-subtle-bg)]"
                      : "border-transparent hover:bg-[var(--bg-surface-hover)]"
                  }`}
                >
                  <Avatar className="h-9 w-9">
                    {s.rider.photo_url && (
                      <AvatarImage
                        src={s.rider.photo_url}
                        alt={s.rider.full_name}
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <AvatarFallback>
                      {s.rider.full_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[length:var(--type-body)] font-medium text-[var(--text-high)]">
                      {s.rider.full_name}
                    </span>
                    <span className="truncate text-[length:var(--type-caption)] text-[var(--text-low)]">
                      {s.rider.real_team ?? ""}
                    </span>
                  </div>
                  <span className="shrink-0 text-[length:var(--type-label)] uppercase tracking-wide text-[var(--text-low)]">
                    {labelFor(s.role)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {err && (
          <p className="my-2 text-[length:var(--type-caption)] text-[var(--danger)]">
            {err}
          </p>
        )}

        <div className="mt-4 flex flex-col-reverse gap-2 lg:flex-row lg:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[length:var(--type-body)] font-medium text-[var(--text-mid)] hover:text-[var(--text-high)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!selectedId || pending}
            className="rounded-[var(--radius-md)] bg-[var(--accent-default)] px-4 py-2 font-semibold text-[var(--color-b1-1)] disabled:opacity-50"
          >
            {pending ? "Saving..." : "Attribute new role"}
          </button>
        </div>
      </div>
    </div>
  );
}

function labelFor(role: GtRole): string {
  switch (role) {
    case "gc_leader":
      return "GC Leader";
    case "sprinter":
      return "Sprinter";
    case "climber":
      return "Climber";
    case "tt_specialist":
      return "TT Specialist";
    case "stage_hunter":
      return "Stage Hunter";
    default:
      return "Domestique";
  }
}
