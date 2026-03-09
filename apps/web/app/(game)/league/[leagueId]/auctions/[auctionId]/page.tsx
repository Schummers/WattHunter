import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TreasuryWidget } from "./treasury-widget";
import { AuctionClient } from "./auction-client";

function rankMaxForLevel(level: number): number {
  const thresholds = [500, 350, 250, 175, 100, 75, 50, 25, 10, 3];
  return thresholds[Math.min(Math.max(level, 1), 10) - 1];
}

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ leagueId: string; auctionId: string }>;
}) {
  const { leagueId, auctionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch team first so we can use its level to gate the riders query
  const { data: team } = await supabase
    .from("teams")
    .select("*")
    .eq("user_id", user.id)
    .eq("league_id", leagueId)
    .single();

  const [
    { data: auction },
    { data: riders },
    { data: myBids },
    { data: contracts },
  ] = await Promise.all([
    supabase.from("auctions").select("*").eq("id", auctionId).single(),
    supabase
      .from("riders")
      .select("*")
      .eq("ever_in_top500", true)
      .lte("pcs_rank", rankMaxForLevel(team?.level ?? 1))
      .order("pcs_points_1yr", { ascending: false }),
    supabase.from("auction_bids").select("*").eq("auction_id", auctionId),
    supabase.from("contracts").select("rider_id").in("status", ["active", "notice"]),
  ]);

  if (!auction || !team) {
    return <p className="text-[var(--text-mid)]">Auction not found.</p>;
  }

  const now = new Date();
  const opens = new Date(auction.opens_at);
  const currentRound = Math.min(
    Math.max(Math.floor((now.getTime() - opens.getTime()) / 86400000) + 1, 1),
    3
  );

  const myCurrentBids = (myBids ?? []).filter(
    (b) => b.team_id === team.id && b.round === currentRound && b.status === "active"
  );
  const activeBidsTotal = myCurrentBids.reduce((sum, b) => sum + b.amount, 0);

  const contractedIds = new Set((contracts ?? []).map((c) => c.rider_id));
  const enrichedRiders = (riders ?? []).map((r) => ({
    ...r,
    is_contracted: contractedIds.has(r.id),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">{auction.name}</h1>
        <div className="flex items-center gap-3 text-[length:var(--type-body)] text-[var(--text-mid)]">
          <span>Round {currentRound}/3</span>
          <span>·</span>
          <span>Resolves at midnight</span>
          <span>·</span>
          <Link
            href={`/league/${leagueId}/auctions/${auctionId}/results`}
            className="text-[var(--accent-default)] hover:underline"
          >
            View results
          </Link>
        </div>
      </div>

      <TreasuryWidget treasury={team.treasury} activeBidsTotal={activeBidsTotal} />

      <AuctionClient
        riders={enrichedRiders}
        myBids={myCurrentBids}
        team={team}
        auctionId={auctionId}
        currentRound={currentRound}
      />
    </div>
  );
}
