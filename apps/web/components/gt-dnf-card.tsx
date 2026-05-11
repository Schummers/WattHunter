"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { claimDnfRefund } from "@/app/(game)/league/[leagueId]/team/gt/actions";
import { resolvePhotoUrl } from "@/lib/photo-url";

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

  const borderColor = claimed
    ? "rgba(34,197,94,0.5)"   // green-500 at 50% — success
    : "rgba(217,119,6,0.5)";  // amber at 50% — warning

  return (
    <div
      className="mx-4 mt-4 overflow-hidden relative"
      style={{
        borderRadius: 12,
        border: `1px solid ${borderColor}`,
        minHeight: 110,
        transition: "border-color 400ms",
      }}
    >
      {/* Background photo */}
      {resolvedPhoto && (
        <>
          <Image
            src={resolvedPhoto}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 600px"
            className="object-cover object-top"
            style={{ zIndex: 0 }}
            priority
          />
          {/* Dark gradient overlay — left heavier for text legibility */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to right, rgba(10,12,18,0.88) 0%, rgba(10,12,18,0.72) 55%, rgba(10,12,18,0.55) 100%)",
              zIndex: 1,
            }}
          />
        </>
      )}

      {/* Card content */}
      <div
        className="relative flex items-center justify-between px-4 py-3 gap-3"
        style={{ zIndex: 2, minHeight: 110 }}
      >
        {/* Left — text */}
        <div className="flex flex-col gap-1 min-w-0">
          <span
            style={{
              fontSize: "var(--type-emphasis)",
              fontWeight: 700,
              color: "var(--text-high)",
              lineHeight: 1.2,
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
        </div>

        {/* Right — buttons stacked */}
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={handleRefundAndReplace}
            disabled={loading || claimed}
            style={{
              fontSize: "var(--type-caption)",
              fontWeight: 600,
              borderRadius: 6,
              padding: "6px 12px",
              border: "none",
              background: "var(--accent-default)",
              color: "#fff",
              cursor: loading || claimed ? "not-allowed" : "pointer",
              opacity: loading || claimed ? 0.6 : 1,
              whiteSpace: "nowrap",
              transition: "background 150ms",
            }}
          >
            {loading ? "Processing…" : "Refund & Replace"}
          </button>
          <button
            onClick={handleRefund}
            disabled={loading || claimed}
            style={{
              fontSize: "var(--type-caption)",
              fontWeight: 600,
              borderRadius: 6,
              padding: "6px 12px",
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.08)",
              color: "var(--text-high)",
              cursor: loading || claimed ? "not-allowed" : "pointer",
              opacity: loading || claimed ? 0.6 : 1,
              whiteSpace: "nowrap",
              transition: "background 150ms",
            }}
          >
            {loading ? "Processing…" : `Refund +${refundK}€`}
          </button>
        </div>
      </div>
    </div>
  );
}
