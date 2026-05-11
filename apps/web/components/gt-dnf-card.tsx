"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { claimDnfRefund } from "@/app/(game)/league/[leagueId]/team/gt/actions";
import { resolvePhotoUrl } from "@/lib/photo-url";
import { Button } from "@/components/ui/button";

export interface GtDnfCardProps {
  leagueId: string;
  gtSquadId: string;
  contractId: string;
  riderName: string;
  photoUrl: string | null;
  dnfStage: number;
  gtXp: number;
  refundAmount: number;
}

export function GtDnfCard({
  leagueId,
  gtSquadId,
  contractId,
  riderName,
  photoUrl,
  dnfStage,
  gtXp,
  refundAmount,
}: GtDnfCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refundK = refundAmount >= 1000
    ? `${Math.round(refundAmount / 1000)}k`
    : String(refundAmount);

  const resolvedPhoto = resolvePhotoUrl(photoUrl);

  async function handleRefund() {
    setLoading(true);
    setError(null);
    const result = await claimDnfRefund(gtSquadId, contractId);
    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setClaimed(true);
    router.refresh();
  }

  async function handleRefundAndReplace() {
    setLoading(true);
    setError(null);
    const result = await claimDnfRefund(gtSquadId, contractId);
    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push(`/league/${leagueId}/team/gt/rescue`);
  }

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: `1px solid ${claimed ? "rgba(34,197,94,0.4)" : "rgba(217,119,6,0.4)"}`,
        borderRadius: 12,
        transition: "border-color 400ms",
      }}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Photo — rectangular, 8px radius */}
        {resolvedPhoto ? (
          <Image
            src={resolvedPhoto}
            alt={riderName}
            width={48}
            height={56}
            style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 56,
              borderRadius: 8,
              background: "var(--bg-subtle)",
              flexShrink: 0,
            }}
          />
        )}

        {/* Content */}
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span
            style={{
              fontSize: "var(--type-emphasis)",
              fontWeight: 700,
              color: "var(--text-high)",
              lineHeight: 1.3,
            }}
          >
            {riderName} — DNF Stage {dnfStage}
          </span>
          <span
            style={{
              fontSize: "var(--type-caption)",
              color: "var(--text-mid)",
              lineHeight: 1.4,
            }}
          >
            {gtXp > 0
              ? `Get a 50% refund — ${gtXp} XP earned will be forfeited`
              : "Get a 50% refund — no GT XP will be lost"}
          </span>

          {error && (
            <span style={{ fontSize: "var(--type-caption)", color: "#ef4444" }}>
              {error}
            </span>
          )}

          {/* Buttons */}
          <div className="flex gap-2 mt-1.5">
            <Button
              size="xs"
              onClick={handleRefundAndReplace}
              disabled={loading || claimed}
            >
              {loading ? "Processing…" : "Refund & Replace"}
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={handleRefund}
              disabled={loading || claimed}
            >
              {loading ? "…" : `Refund +${refundK}€`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
