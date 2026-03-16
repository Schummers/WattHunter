import { createClient } from "@/lib/supabase/server";
import { RiderDetailClient } from "./rider-detail-client";
import { getMaxSlots } from "@/lib/levels";
import { calcMinSalary } from "@/lib/format";
import { isInAuctionWindow, getNextPhase, getCurrentPhase, getPhaseById } from "@/lib/phases";

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
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">Rider not found.</p>
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
  let contractData: { locked_salary: number; status: string; contractId?: string; effectivePhaseName?: string } | null = null;
  let currentBidAmount: number | null = null;
  let currentBidId: string | null = null;
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
        .select("id, locked_salary, status, effective_phase_id")
        .eq("team_id", member.team_id)
        .eq("rider_id", riderId)
        .in("status", ["active", "notice"])
        .maybeSingle();

      if (contract) {
        if (from !== "recruts" && from !== "team") context = "team";
        const phaseName = contract.effective_phase_id
          ? getPhaseById(contract.effective_phase_id)?.label
          : undefined;
        contractData = {
          locked_salary: contract.locked_salary,
          status: contract.status,
          contractId: contract.id,
          effectivePhaseName: phaseName,
        };
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
        currentBidId = activeBid.id;
        currentBidAmount = activeBid.amount;
        activeAuctionId = activeBid.auction_id;
      }

      // Get active auction for recruts context
      if (!activeAuctionId) {
        const { data: auction } = await supabase
          .from("auctions")
          .select("id")
          .eq("league_id", leagueId)
          .in("status", ["active", "open"])
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
        // Fetch owner display_name via league_members
        const { data: ownerMember } = await supabase
          .from("league_members")
          .select("user_id, users(display_name)")
          .eq("team_id", ownerContract.team_id)
          .eq("league_id", leagueId)
          .maybeSingle();

        const ownerUser = ownerMember
          ? (Array.isArray(ownerMember.users) ? ownerMember.users[0] : ownerMember.users)
          : null;
        const displayName = (ownerUser as { display_name?: string })?.display_name ?? "Unknown";

        ownerInfo = {
          display_name: displayName,
          team_name: (ownerTeam as { name: string }).name,
        };
      }
    }
  }

  const minSalary = calcMinSalary(rider.pcs_points_1yr ?? 0);

  // Release availability (only during auction window)
  const now = new Date();
  const canRelease = isInAuctionWindow(now);
  const nextPhase = getNextPhase(getCurrentPhase(now));
  const nextPhaseName = nextPhase?.label ?? null;

  // Phase 1.3: Budget info for recruts context
  let budgetInfo: { currentSlots: number; maxSlots: number; treasury: number; totalBidAmount: number; activeBidCount: number } | undefined;
  if (context === "recruts" && user) {
    const { data: memberForBudget } = await supabase
      .from("league_members")
      .select("team_id, teams:team_id(level, treasury)")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .single();

    if (memberForBudget?.team_id) {
      const budgetTeam = Array.isArray(memberForBudget.teams) ? memberForBudget.teams[0] : memberForBudget.teams;
      const level = budgetTeam?.level ?? 1;
      const maxSlots = getMaxSlots(level);

      const { count: contractCount } = await supabase
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("team_id", memberForBudget.team_id)
        .in("status", ["active", "notice"]);

      const { data: activeBids } = await supabase
        .from("auction_bids")
        .select("amount")
        .eq("team_id", memberForBudget.team_id)
        .eq("status", "active");

      const totalBidAmount = (activeBids ?? []).reduce((sum, b) => sum + b.amount, 0);
      const activeBidCount = (activeBids ?? []).length;

      budgetInfo = {
        currentSlots: contractCount ?? 0,
        maxSlots,
        treasury: budgetTeam?.treasury ?? 200000,
        totalBidAmount,
        activeBidCount,
      };
    }
  }

  return (
    <RiderDetailClient
      leagueId={leagueId}
      currentBidId={currentBidId ?? undefined}
      budgetInfo={budgetInfo}
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
      canRelease={canRelease}
      nextPhaseName={nextPhaseName}
    />
  );
}
