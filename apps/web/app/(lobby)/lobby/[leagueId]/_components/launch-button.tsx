"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { launchFirstAuction } from "@/app/(game)/league/[leagueId]/actions";

export interface LaunchButtonProps {
  leagueId: string;
  isCommissioner: boolean;
  memberCount: number;
}

export function LaunchButton({
  leagueId,
  isCommissioner,
  memberCount,
}: LaunchButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isCommissioner) {
    return (
      <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        Waiting for the Race Director to start the auction.
      </p>
    );
  }

  const canLaunch = memberCount >= 1;

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await launchFirstAuction(leagueId);
      if (result && "error" in result && result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p className="text-[length:var(--type-body)] text-[var(--status-danger)]">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant="cta"
        className="w-full"
        disabled={!canLaunch || pending}
        onClick={handleClick}
      >
        {pending ? "Launching…" : "Launch first auction"}
      </Button>
    </div>
  );
}
