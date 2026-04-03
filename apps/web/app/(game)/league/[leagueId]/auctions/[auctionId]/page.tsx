import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { redirect } from "next/navigation";
import { getLevelByNumber } from "@/lib/levels";
import { TreasuryWidget } from "./treasury-widget";
import { AuctionClient } from "./auction-client";

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ leagueId: string; auctionId: string }>;
}) {
  const { leagueId, auctionId } = await params;
  const supabase = await createClient();

  const user = await getUser();
  if (!user) redirect("/login");

  // Fetch team first so we can use its level to gate the riders query
  const { data: team } = await supabase
    .from("teams")
    .select("id, treasury, level, league_id, user_id")
    .eq("user_id", user.id)
    .eq("league_id", leagueId)
    .single();

  const [
    { data: auction },
    { data: riders },
    { data: myBids },
    { data: contracts },
    { data: teamContracts },
    { data: teamSponsors },
  ] = await Promise.all([
    supabase
      .from("auctions")
      .select("id, name, opens_at")
      .eq("id", auctionId)
      .single(),
    supabase
      .from("riders")
      .select("id, full_name, nationality, photo_url, pcs_rank, pcs_points_1yr, specialty, real_team, monthly_salary, age")
      .eq("ever_in_pool", true)
      .gte("pcs_rank", getLevelByNumber(team?.level ?? 1).poolMin)
      .lte("pcs_rank", 600)
      .order("pcs_points_1yr", { ascending: false }),
    supabase
      .from("auction_bids")
      .select("id, rider_id, team_id, amount, round, status")
      .eq("auction_id", auctionId),
    supabase.from("contracts").select("rider_id").eq("status", "active"),
    supabase.from("contracts").select("locked_salary").eq("status", "active").eq("team_id", team?.id),
    supabase.from("team_sponsors").select("sponsors(monthly_budget)").eq("team_id", team?.id).maybeSingle(),
  ]);

  if (!auction || !team) {
    return <p className="text-[var(--text-mid)]">Auction not found.</p>;
  }

  const activeSalaries = (teamContracts ?? []).reduce(
    (sum, c) => sum + (c.locked_salary ?? 0),
    0
  );

  let sponsorIncome = 0;
  if (teamSponsors?.sponsors) {
    const sp = Array.isArray(teamSponsors.sponsors) ? teamSponsors.sponsors[0] : teamSponsors.sponsors;
    sponsorIncome = (sp as { monthly_budget: number }).monthly_budget ?? 0;
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

      <TreasuryWidget 
        treasury={team.treasury} 
        sponsorIncome={sponsorIncome}
        activeSalaries={activeSalaries}
        activeBidsTotal={activeBidsTotal} 
      />

      <AuctionClient
        riders={enrichedRiders}
        myBids={myCurrentBids}
        team={team}
        sponsorIncome={sponsorIncome}
        activeSalaries={activeSalaries}
        auctionId={auctionId}
        currentRound={currentRound}
      />
    </div>
  );
}
