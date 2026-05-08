import { createClient } from "@/lib/supabase/server";
import { RiderDetailClient } from "./rider-detail-client";
import { fetchRiderDetailData } from "@/lib/rider-detail-data";

export default async function RiderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string; riderId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { leagueId, riderId } = await params;
  const { from } = await searchParams;
  const supabase = await createClient();

  const data = await fetchRiderDetailData(supabase, leagueId, riderId, from);

  if (!data) {
    return (
      <div className="px-4 py-8">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          Rider not found.
        </p>
      </div>
    );
  }

  return (
    <RiderDetailClient
      leagueId={leagueId}
      {...data}
      currentBidId={data.currentBidId ?? undefined}
    />
  );
}
