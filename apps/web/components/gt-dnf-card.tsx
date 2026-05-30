"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { claimDnfRefund } from "@/app/(game)/league/[leagueId]/team/gt/actions";
import { useDemoSafeAction } from "@/contexts/demo-context";
import { resolvePhotoUrl } from "@/lib/photo-url";
import { formatXp } from "@/lib/format";
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
  initialClaimed?: boolean;
  hasActiveBid?: boolean;
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
  initialClaimed,
  hasActiveBid,
}: GtDnfCardProps) {
  const router = useRouter();
  const claimDnfRefundSafe = useDemoSafeAction(claimDnfRefund);
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(initialClaimed ?? false);
  const [error, setError] = useState<string | null>(null);

  const refundK = refundAmount >= 1000
    ? `${Math.round(refundAmount / 1000)}k`
    : String(refundAmount);

  const resolvedPhoto = resolvePhotoUrl(photoUrl);

  async function handleRefund() {
    setLoading(true);
    setError(null);
    const result = await claimDnfRefundSafe(gtSquadId, contractId, leagueId);
    if (result && "blocked" in result) { setLoading(false); return; }
    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setClaimed(true);
    setLoading(false);
  }

  async function handleRefundAndReplace() {
    // If already claimed, just navigate to rescue page (no second refund)
    if (claimed) {
      router.push(`/league/${leagueId}/team/gt/rescue`);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await claimDnfRefundSafe(gtSquadId, contractId, leagueId);
    if (result && "blocked" in result) { setLoading(false); return; }
    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push(`/league/${leagueId}/team/gt/rescue`);
  }

  return (
    <div
      className="mt-2 overflow-hidden relative"
      style={{
        border: `1px solid ${claimed ? "rgba(34,197,94,0.4)" : "rgba(217,119,6,0.4)"}`,
        borderRadius: 12,
        transition: "border-color 400ms",
      }}
    >
      {/* GT background image */}
      <Image
        src="/images/gt/dnf-card-bg.webp"
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 600px"
        className="object-cover object-center"
        style={{ zIndex: 0 }}
      />
      {/* Dark overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to right, rgba(10,12,18,0.82) 0%, rgba(10,12,18,0.65) 60%, rgba(10,12,18,0.50) 100%)",
          zIndex: 1,
        }}
      />

      <div className="relative flex items-start gap-3 p-3" style={{ zIndex: 2 }}>
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
              background: "rgba(255,255,255,0.08)",
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
              ? `Get a 50% refund — ${formatXp(gtXp)} XP earned will be forfeited`
              : "Get a 50% refund — no GT XP will be lost"}
          </span>

          {error && (
            <span style={{ fontSize: "var(--type-caption)", color: "#ef4444" }}>
              {error}
            </span>
          )}

          {/* Buttons — secondary left, primary right */}
          <div className="flex gap-2 mt-1.5">
            <Button
              size="xs"
              variant="outline"
              onClick={handleRefund}
              disabled={loading || claimed}
              style={{
                background: "rgba(10,12,18,0.7)",
                borderColor: "rgba(255,255,255,0.25)",
                color: "var(--text-high)",
                backdropFilter: "blur(4px)",
              }}
            >
              {loading ? "…" : `Refund +${refundK}€`}
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={handleRefundAndReplace}
              disabled={loading || hasActiveBid}
              style={{
                background: "rgba(10,12,18,0.7)",
                borderColor: "rgba(255,255,255,0.25)",
                color: "var(--text-high)",
                backdropFilter: "blur(4px)",
              }}
            >
              {loading ? "…" : claimed ? (hasActiveBid ? "Bet placed" : "Replace") : "Refund & Replace"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
