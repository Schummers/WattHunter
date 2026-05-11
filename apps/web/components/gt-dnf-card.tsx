"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { WarningCircle } from "@phosphor-icons/react";
import { claimDnfRefund } from "@/app/(game)/league/[leagueId]/team/gt/actions";

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
  const [error, setError] = useState<string | null>(null);

  const refundK = refundAmount >= 1000
    ? `${Math.round(refundAmount / 1000)}k`
    : String(refundAmount);

  async function handleRefund() {
    setLoading(true);
    setError(null);
    const result = await claimDnfRefund(gtSquadId, contractId);
    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }
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
        border: "1px solid var(--border-default)",
        borderLeft: "3px solid #d97706",
        borderRadius: "var(--radius-lg)",
      }}
      className="mx-4 mt-4 overflow-hidden"
    >
      {/* Header */}
      <div
        style={{
          background: "rgba(217, 119, 6, 0.08)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
        className="flex items-center gap-2 px-4 py-3"
      >
        <WarningCircle
          size={16}
          weight="fill"
          style={{ color: "#d97706", flexShrink: 0 }}
        />
        <span
          style={{
            fontSize: "var(--type-caption)",
            color: "#d97706",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Rider DNF — Stage {dnfStage}
        </span>
      </div>

      {/* Body */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Photo */}
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={riderName}
            width={40}
            height={40}
            className="rounded-full object-cover"
            style={{ flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--bg-surface-hover)",
              border: "1px solid var(--border-default)",
              flexShrink: 0,
            }}
          />
        )}

        {/* Rider info */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            style={{
              fontSize: "var(--type-body)",
              color: "var(--text-high)",
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {riderName}
          </span>
          <span
            style={{
              fontSize: "var(--type-caption)",
              color: "var(--text-mid)",
            }}
          >
            {gtXp > 0
              ? `Earned ${gtXp} XP on this GT — forfeited on refund`
              : "No XP earned on this GT"}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 pb-2">
          <span
            style={{
              fontSize: "var(--type-caption)",
              color: "#ef4444",
            }}
          >
            {error}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        <button
          onClick={handleRefund}
          disabled={loading}
          style={{
            fontSize: "var(--type-caption)",
            fontWeight: 600,
            borderRadius: "var(--radius-md)",
            padding: "6px 12px",
            border: "1px solid var(--border-default)",
            background: "var(--bg-surface-hover)",
            color: "var(--text-high)",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            transition: "background 150ms",
          }}
          onMouseEnter={(e) => {
            if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface-active)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface-hover)";
          }}
        >
          {loading ? "Processing…" : `Refund +${refundK}€`}
        </button>

        <button
          onClick={handleRefundAndReplace}
          disabled={loading}
          style={{
            fontSize: "var(--type-caption)",
            fontWeight: 600,
            borderRadius: "var(--radius-md)",
            padding: "6px 12px",
            border: "none",
            background: "var(--accent-default)",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            transition: "background 150ms",
          }}
          onMouseEnter={(e) => {
            if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-default)";
          }}
        >
          {loading ? "Processing…" : "Refund & Replace"}
        </button>
      </div>
    </div>
  );
}
