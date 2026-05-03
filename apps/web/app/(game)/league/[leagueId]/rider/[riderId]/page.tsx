import { createClient } from "@/lib/supabase/server";
import { RiderDetailClient } from "./rider-detail-client";
import { getMaxSlots } from "@/lib/levels";
import { calcMinSalary } from "@/lib/format";
import { getCurrentPhase } from "@/lib/phases";


type RiderContext = "market" | "team" | "ranking";

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

  // Run rider data fetches and auth in parallel
  const [
    { data: rider },
    { data: rankings },
    { data: riderTeams },
    { data: startlists },
    { data: xpDailyRaw },
    {
      data: { user },
    },
    { data: sponsorBonusesRaw },
  ] = await Promise.all([
    supabase.from("riders").select("*").eq("id", riderId).single(),
    supabase
      .from("rider_season_rankings")
      .select("*")
      .eq("rider_id", riderId)
      .order("season", { ascending: false }),
    supabase
      .from("rider_teams")
      .select("season, team_name")
      .eq("rider_id", riderId),
    supabase
      .from("race_startlists")
      .select("race_slug, race_name, race_date")
      .eq("rider_id", riderId)
      .order("race_date", { ascending: true }),
    // Game results only: rider_xp_daily (races under contract)
    supabase
      .from("rider_xp_daily")
      .select("race_slug, xp_gained, raw_pcs_points, date, team_id")
      .eq("rider_id", riderId)
      .order("date", { ascending: false }),
    supabase.auth.getUser(),
    supabase
      .from("sponsor_bonuses")
      .select("final_bonus, team_id")
      .eq("rider_id", riderId),
  ]);

  // Fetch race metadata (name, date, rank) for game results
  const gameRaceSlugs = [...new Set((xpDailyRaw ?? []).map((x) => x.race_slug).filter(Boolean))];
  const { data: raceMetaRaw } = gameRaceSlugs.length > 0
    ? await supabase
        .from("race_results")
        .select("race_slug, race_name, race_date, rank")
        .eq("rider_id", riderId)
        .in("race_slug", gameRaceSlugs)
    : { data: [] };

  // Build lookup: race_slug → metadata
  const raceMeta: Record<string, { race_name: string; race_date: string | null; rank: number | null }> = {};
  for (const r of raceMetaRaw ?? []) {
    if (!raceMeta[r.race_slug]) {
      raceMeta[r.race_slug] = { race_name: r.race_name, race_date: r.race_date, rank: r.rank };
    }
  }

  // Merge XP data + metadata into race results
  const raceResults = (xpDailyRaw ?? []).map((x) => {
    const meta = raceMeta[x.race_slug] ?? { race_name: x.race_slug, race_date: x.date, rank: null };
    return {
      race_name: meta.race_name,
      race_date: meta.race_date ?? x.date,
      xp_gained: x.xp_gained,
      pcs_points: x.raw_pcs_points,
      rank: meta.rank,
      team_id: x.team_id,
    };
  });

  // Compute game XP and sponsor bonus totals (team-filtered for "team" context, global otherwise)
  // These are computed before we know context/team, so we derive both scopes and pick later
  const allXp = (xpDailyRaw ?? []).reduce((sum, x) => sum + (x.xp_gained ?? 0), 0);
  const allBonus = (sponsorBonusesRaw ?? []).reduce((sum, b) => sum + (b.final_bonus ?? 0), 0);

  if (!rider) {
    return (
      <div className="px-4 py-8">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">Rider not found.</p>
      </div>
    );
  }

  const teamBySeason: Record<number, string> = {};
  for (const rt of riderTeams ?? []) {
    teamBySeason[rt.season] = rt.team_name;
  }

  // Auth + team check

  let context: RiderContext = (from as RiderContext) ?? "ranking";
  let contractData: { locked_salary: number; status: string; contractId?: string; pcsPoints?: number } | null = null;
  let currentBidAmount: number | null = null;
  let currentBidId: string | null = null;
  let activeAuctionId: string | null = null;
  let ownerInfo: { display_name: string; team_name: string } | null = null;
  let userTeamId: string | null = null;
  let draftAmount: number | null = null;
  let currentRound: number | null = null;

  if (user) {
    const { data: member } = await supabase
      .from("league_members")
      .select("id, team_id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .single();

    if (member?.team_id) {
      userTeamId = member.team_id;
      // Check if owned and current bid in parallel
      const [{ data: contract }, { data: activeBid }] = await Promise.all([
        supabase
          .from("contracts")
          .select("id, locked_salary, status")
          .eq("team_id", member.team_id)
          .eq("rider_id", riderId)
          .eq("status", "active")
          .maybeSingle(),
        supabase
          .from("auction_bids")
          .select("id, amount, auction_id")
          .eq("team_id", member.team_id)
          .eq("rider_id", riderId)
          .eq("status", "active")
          .maybeSingle(),
      ]);

      if (contract) {
        if (from !== "market" && from !== "team") context = "team";
        contractData = {
          locked_salary: contract.locked_salary,
          status: contract.status,
          contractId: contract.id,
          pcsPoints: rider.pcs_points_1yr ?? undefined,
        };
      }

      if (activeBid) {
        currentBidId = activeBid.id;
        currentBidAmount = activeBid.amount;
        activeAuctionId = activeBid.auction_id;
      }

      // Check if rider is in draft bids
      const { data: draftBid } = await supabase
        .from("draft_bids")
        .select("amount")
        .eq("team_id", member.team_id)
        .eq("rider_id", riderId)
        .maybeSingle();

      if (draftBid) {
        draftAmount = draftBid.amount;
      }

      // Get active auction for market context + round info
      if (!activeAuctionId) {
        const { data: auction } = await supabase
          .from("auctions")
          .select("id, name")
          .eq("league_id", leagueId)
          .in("status", ["active", "open"])
          .maybeSingle();
        if (auction) {
          activeAuctionId = auction.id;
          const m = auction.name.match(/(\d+)/);
          currentRound = m ? parseInt(m[1], 10) : null;
        }
      } else {
        const { data: auction } = await supabase
          .from("auctions")
          .select("name")
          .eq("id", activeAuctionId)
          .maybeSingle();
        if (auction) {
          const m = auction.name.match(/(\d+)/);
          currentRound = m ? parseInt(m[1], 10) : null;
        }
      }
    }
  }

  // If ranking context, check who owns this rider (join contracts → teams for league_id)
  if (context === "ranking") {
    const { data: ownerContract } = await supabase
      .from("contracts")
      .select("team_id, teams:team_id(name, league_id)")
      .eq("rider_id", riderId)
      .eq("status", "active")
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

  // Pick team-scoped totals for "team" context, global totals for market/ranking
  let gameXp: number;
  let totalBonus: number;
  if (context === "team" && userTeamId) {
    gameXp = (xpDailyRaw ?? [])
      .filter((x) => x.team_id === userTeamId)
      .reduce((sum, x) => sum + (x.xp_gained ?? 0), 0);
    totalBonus = (sponsorBonusesRaw ?? [])
      .filter((b) => b.team_id === userTeamId)
      .reduce((sum, b) => sum + (b.final_bonus ?? 0), 0);
  } else {
    gameXp = allXp;
    totalBonus = allBonus;
  }

  // Budget info for market/recruts contexts (add-to-draft flow)
  let budgetInfo: {
    currentSlots: number;
    maxSlots: number;
    treasury: number;
    sponsorIncome: number;
    activeSalaries: number;
    totalDraftBidsAmount: number;
    draftBidsCount: number;
    phaseConfirmed: boolean;
  } | undefined;
  if ((context === "market" || from === "recruts") && user) {
    const { data: memberForBudget } = await supabase
      .from("league_members")
      .select("team_id, teams:team_id(level, treasury, phase_confirmed_id)")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .single();

    if (memberForBudget?.team_id) {
      const budgetTeam = Array.isArray(memberForBudget.teams) ? memberForBudget.teams[0] : memberForBudget.teams;
      const level = budgetTeam?.level ?? 1;
      const maxSlots = getMaxSlots(level);

      const [
        { data: contracts },
        { data: draftBids },
        { data: sponsorData },
      ] = await Promise.all([
        supabase
          .from("contracts")
          .select("id, locked_salary")
          .eq("team_id", memberForBudget.team_id)
          .eq("status", "active"),
        supabase
          .from("draft_bids")
          .select("amount")
          .eq("team_id", memberForBudget.team_id),
        supabase
          .from("team_sponsors")
          .select("sponsors(monthly_budget)")
          .eq("team_id", memberForBudget.team_id)
          .maybeSingle(),
      ]);

      const currentSlots = (contracts ?? []).length;
      const activeSalaries = (contracts ?? []).reduce((sum, c) => sum + (c.locked_salary ?? 0), 0);
      const totalDraftBidsAmount = (draftBids ?? []).reduce((sum, b) => sum + (b.amount ?? 0), 0);
      const draftBidsCount = (draftBids ?? []).length;
      
      let sponsorIncome = 0;
      if (sponsorData?.sponsors) {
        const sp = Array.isArray(sponsorData.sponsors) ? sponsorData.sponsors[0] : sponsorData.sponsors;
        sponsorIncome = (sp as { monthly_budget: number }).monthly_budget ?? 0;
      }

      const phaseConfirmedId = (budgetTeam as { phase_confirmed_id?: number | null })?.phase_confirmed_id ?? null;
      budgetInfo = {
        currentSlots,
        maxSlots,
        treasury: budgetTeam?.treasury ?? 0,
        sponsorIncome,
        activeSalaries,
        totalDraftBidsAmount,
        draftBidsCount,
        phaseConfirmed: phaseConfirmedId === getCurrentPhase().id,
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
      raceResults={raceResults}
      context={context}
      minSalary={minSalary}
      currentBidAmount={currentBidAmount}
      activeAuctionId={activeAuctionId}
      contractData={contractData}
      ownerInfo={ownerInfo}
      gameXp={gameXp}
      totalBonus={totalBonus}
      draftAmount={draftAmount}
      currentRound={currentRound}
    />
  );
}
