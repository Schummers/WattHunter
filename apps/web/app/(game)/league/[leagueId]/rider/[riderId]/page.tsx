import { createClient } from "@/lib/supabase/server";
import { RiderDetailClient } from "./rider-detail-client";

type RiderContext = "recruts" | "team" | "ranking";

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

  // Get rider
  const { data: rider } = await supabase
    .from("riders")
    .select("*")
    .eq("id", riderId)
    .single();

  if (!rider) {
    return (
      <div className="px-4 py-8">
        <p className="text-sm text-[var(--text-mid)]">Rider not found.</p>
      </div>
    );
  }

  // Get season rankings + teams for table
  const { data: rankings } = await supabase
    .from("rider_season_rankings")
    .select("*")
    .eq("rider_id", riderId)
    .order("season", { ascending: false });

  const { data: riderTeams } = await supabase
    .from("rider_teams")
    .select("season, team_name")
    .eq("rider_id", riderId);

  const teamBySeason: Record<number, string> = {};
  for (const rt of riderTeams ?? []) {
    teamBySeason[rt.season] = rt.team_name;
  }

  // Get race startlists for programme
  const { data: startlists } = await supabase
    .from("race_startlists")
    .select("race_slug, race_name, race_date")
    .eq("rider_id", riderId)
    .order("race_date", { ascending: true });

  // Get race results for game stats
  const { data: raceResults } = await supabase
    .from("race_results")
    .select("race_name, race_date, pcs_points, rider_id")
    .eq("rider_id", riderId)
    .order("race_date", { ascending: false });

  // Auth + team check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let context: RiderContext = (from as RiderContext) ?? "ranking";
  let contractData: { locked_salary: number; status: string } | null = null;
  let currentBidAmount: number | null = null;
  let activeAuctionId: string | null = null;
  let ownerInfo: { display_name: string; team_name: string } | null = null;

  if (user) {
    const { data: member } = await supabase
      .from("league_members")
      .select("id, team_id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .single();

    if (member?.team_id) {
      // Check if owned
      const { data: contract } = await supabase
        .from("contracts")
        .select("id, locked_salary, status")
        .eq("team_id", member.team_id)
        .eq("rider_id", riderId)
        .in("status", ["active", "notice"])
        .maybeSingle();

      if (contract) {
        if (context !== "ranking") context = "team";
        contractData = { locked_salary: contract.locked_salary, status: contract.status };
      }

      // Check current bid (for recruts context)
      const { data: activeBid } = await supabase
        .from("auction_bids")
        .select("id, amount, auction_id")
        .eq("team_id", member.team_id)
        .eq("rider_id", riderId)
        .eq("status", "active")
        .maybeSingle();

      if (activeBid) {
        currentBidAmount = activeBid.amount;
        activeAuctionId = activeBid.auction_id;
      }

      // Get active auction for recruts context
      if (!activeAuctionId) {
        const { data: auction } = await supabase
          .from("auctions")
          .select("id")
          .eq("league_id", leagueId)
          .eq("status", "active")
          .maybeSingle();
        if (auction) activeAuctionId = auction.id;
      }
    }
  }

  // If ranking context, check who owns this rider (join contracts → teams for league_id)
  if (context === "ranking") {
    const { data: ownerContract } = await supabase
      .from("contracts")
      .select("team_id, teams:team_id(name, league_id)")
      .eq("rider_id", riderId)
      .in("status", ["active", "notice"])
      .maybeSingle();

    if (ownerContract) {
      const ownerTeam = Array.isArray(ownerContract.teams) ? ownerContract.teams[0] : ownerContract.teams;
      if (ownerTeam && (ownerTeam as { league_id: string }).league_id === leagueId) {
        ownerInfo = {
          display_name: "",
          team_name: (ownerTeam as { name: string }).name,
        };
      }
    }
  }

  const minSalary = Math.max(5000, Math.round(((rider.pcs_points_1yr ?? 0) * 2000) / 12));

  return (
    <RiderDetailClient
      leagueId={leagueId}
      rider={{
        id: rider.id,
        full_name: rider.full_name,
        nationality: rider.nationality,
        team_name: rider.real_team,
        pcs_rank: rider.pcs_rank,
        pcs_points_1yr: rider.pcs_points_1yr,
        photo_url: rider.photo_url,
        specialty: rider.specialty,
        birthdate: rider.birthdate,
        height_cm: rider.height_cm,
        weight_kg: rider.weight_kg,
      }}
      rankings={(rankings ?? []).map((r) => ({
        rider_id: r.rider_id,
        season: r.season,
        points: r.points,
        rank: r.rank,
        team: teamBySeason[r.season] ?? null,
      }))}
      startlists={(startlists ?? []).map((s) => ({
        race_name: s.race_name,
        race_date: s.race_date,
      }))}
      raceResults={(raceResults ?? []).map((r) => ({
        race_name: r.race_name,
        race_date: r.race_date,
        pcs_points: r.pcs_points,
      }))}
      context={context}
      minSalary={minSalary}
      currentBidAmount={currentBidAmount}
      activeAuctionId={activeAuctionId}
      contractData={contractData}
      ownerInfo={ownerInfo}
    />
  );
}
