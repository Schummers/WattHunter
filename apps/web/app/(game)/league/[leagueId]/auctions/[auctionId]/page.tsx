import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TreasuryWidget } from "./treasury-widget";
import { AuctionClient } from "./auction-client";

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

  const [
    { data: auction },
    { data: team },
    { data: riders },
    { data: myBids },
    { data: contracts },
  ] = await Promise.all([
    supabase.from("auctions").select("*").eq("id", auctionId).single(),
    supabase
      .from("teams")
      .select("*")
      .eq("user_id", user.id)
      .eq("league_id", leagueId)
      .single(),
    supabase
      .from("riders")
      .select("*")
      .eq("team_type", "ProTeam")
      .order("pcs_points_1yr", { ascending: false }),
    supabase.from("auction_bids").select("*").eq("auction_id", auctionId),
    supabase.from("contracts").select("rider_id").in("status", ["active", "notice"]),
  ]);

  if (!auction || !team) {
    return <p className="text-muted-foreground">Enchère introuvable.</p>;
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
        <h1 className="text-xl font-semibold text-foreground">{auction.name}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Round {currentRound}/3</span>
          <span>·</span>
          <span>Résolution à minuit</span>
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
