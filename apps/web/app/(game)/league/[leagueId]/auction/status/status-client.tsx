"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { forceResolveRound } from "../actions";

interface Props {
  leagueId: string;
  unvalidatedTeams: string[];
}

export function StatusClient({ leagueId, unvalidatedTeams }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await forceResolveRound({ leagueId });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="space-y-2 pt-6">
        <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          Rounds are resolved automatically when all teams have validated.
          Use this button only if you need to force-close the round manually.
        </p>
        <Button
          variant="outline"
          className="w-full md:w-auto border-[var(--danger-border)] text-[var(--danger)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)] hover:border-[var(--danger-border)]"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          Resolve Round
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve this round?</DialogTitle>
            <DialogDescription>
              Riders will be attributed to the highest bidders, contracts will
              be created, and the next round will open. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          {unvalidatedTeams.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3 text-[length:var(--type-caption)] text-[var(--text-mid)]">
              These teams haven&rsquo;t validated yet. Their bids will not be
              counted:
              <ul className="mt-1 list-disc pl-5">
                {unvalidatedTeams.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3 text-[length:var(--type-caption)] text-[var(--warning)]">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isPending}>
              {isPending ? "Resolving..." : "Resolve Round"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
