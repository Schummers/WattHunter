"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { RiderDetailClient } from "@/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client";
import {
  fetchRiderDetailData,
  type RiderDetailData,
} from "@/lib/rider-detail-data";

interface Props {
  leagueId: string;
  riderId: string;
  from?: string;
}

export default function RiderDetailRail({ leagueId, riderId, from }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RiderDetailData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const result = await fetchRiderDetailData(
        supabase,
        leagueId,
        riderId,
        from,
      );

      if (cancelled) return;

      if (!result) {
        setError("Rider not found");
        setLoading(false);
        return;
      }

      setData(result);
      setLoading(false);
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [leagueId, riderId, from]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-6 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-default)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-4 py-8">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          {error ?? "Error loading rider"}
        </p>
      </div>
    );
  }

  return (
    <RiderDetailClient
      leagueId={leagueId}
      {...data}
      currentBidId={data.currentBidId ?? undefined}
      hideBidSection={from === "mybids"}
      inRail
    />
  );
}
