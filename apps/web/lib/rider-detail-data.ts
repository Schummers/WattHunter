import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getMaxSlots } from "@/lib/levels";
import { calcMinSalary } from "@/lib/format";
import { getCurrentPhase } from "@/lib/phases";

export type RiderContext = "market" | "team" | "ranking";

export interface RiderDetailData {
  rider: {
    id: string;
    full_name: string;
    nationality: string | null;
    team_name: string | null;
    pcs_rank: number | null;
    pcs_points_1yr: number | null;
    photo_url: string | null;
    specialty: string | null;
    birthdate: string | null;
    height_cm: number | null;
    weight_kg: number | null;
  };
  rankings: {
    rider_id: string;
    season: number;
    points: number | null;
    rank: number | null;
    team: string | null;
  }[];
  startlists: {
    race_name: string;
    race_date: string | null;
  }[];
  raceResults: {
    race_name: string;
    race_date: string | null;
    xp_gained: number | null;
    pcs_points: number | null;
    rank: number | null;
    team_id: string | null;
  }[];
  context: RiderContext;
  minSalary: number;
  currentBidId: string | null;
  currentBidAmount: number | null;
  activeAuctionId: string | null;
  contractData: {
    locked_salary: number;
    status: string;
    contractId: string;
    pcsPoints?: number;
  } | null;
  ownerInfo: {
    display_name: string;
    team_name: string;
    locked_salary: number | null;
  } | null;
  budgetInfo?: {
    currentSlots: number;
    maxSlots: number;
    treasury: number;
    sponsorIncome: number;
    activeSalaries: number;
    totalDraftBidsAmount: number;
    draftBidsCount: number;
    phaseConfirmed: boolean;
  };
  gameXp: number;
  totalBonus: number;
  draftAmount: number | null;
  currentRound: number | null;
}

export async function fetchRiderDetailData(
  supabase: SupabaseClient<Database>,
  leagueId: string,
  riderId: string,
  from?: string,
): Promise<RiderDetailData | null> {
  const normalizedFrom = from === "recruts" ? "market" : from;
  let context: RiderContext = (normalizedFrom as RiderContext) ?? "ranking";
  if (context !== "market" && context !== "team" && context !== "ranking") {
    context = "ranking";
  }

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

  if (!rider) return null;

  // Race metadata for game results
  const gameRaceSlugs = [
    ...new Set(
      (xpDailyRaw ?? []).map((x) => x.race_slug).filter(Boolean),
    ),
  ];
  const { data: raceMetaRaw } =
    gameRaceSlugs.length > 0
      ? await supabase
          .from("race_results")
          .select("race_slug, race_name, race_date, rank")
          .eq("rider_id", riderId)
          .in("race_slug", gameRaceSlugs)
      : { data: [] };

  const raceMeta: Record<
    string,
    { race_name: string; race_date: string | null; rank: number | null }
  > = {};
  for (const r of raceMetaRaw ?? []) {
    if (!raceMeta[r.race_slug]) {
      raceMeta[r.race_slug] = {
        race_name: r.race_name,
        race_date: r.race_date,
        rank: r.rank,
      };
    }
  }

  const raceResults = (xpDailyRaw ?? []).map((x) => {
    const meta = raceMeta[x.race_slug] ?? {
      race_name: x.race_slug,
      race_date: x.date,
      rank: null,
    };
    return {
      race_name: meta.race_name,
      race_date: meta.race_date ?? x.date,
      xp_gained: x.xp_gained,
      pcs_points: x.raw_pcs_points,
      rank: meta.rank,
      team_id: x.team_id,
    };
  });

  const teamBySeason: Record<number, string> = {};
  for (const rt of riderTeams ?? []) {
    teamBySeason[rt.season] = rt.team_name;
  }

  // Auth + team check
  let contractData: RiderDetailData["contractData"] = null;
  let currentBidAmount: number | null = null;
  let currentBidId: string | null = null;
  let activeAuctionId: string | null = null;
  let ownerInfo: RiderDetailData["ownerInfo"] = null;
  let userTeamId: string | null = null;
  let draftAmount: number | null = null;
  let currentRound: number | null = null;
  let budgetInfo: RiderDetailData["budgetInfo"];

  if (user) {
    const { data: member } = await supabase
      .from("league_members")
      .select("id, team_id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .single();

    if (member?.team_id) {
      userTeamId = member.team_id;

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
        if (context !== "market" && context !== "team") context = "team";
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

      // Draft bids
      const { data: draftBid } = await supabase
        .from("draft_bids")
        .select("amount")
        .eq("team_id", member.team_id)
        .eq("rider_id", riderId)
        .maybeSingle();

      if (draftBid) {
        draftAmount = draftBid.amount;
      }

      // Active auction + round info
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

      // Budget info for market context
      if (context === "market") {
        const { data: memberForBudget } = await supabase
          .from("league_members")
          .select("team_id, teams:team_id(level, treasury, phase_confirmed_id)")
          .eq("league_id", leagueId)
          .eq("user_id", user.id)
          .single();

        if (memberForBudget?.team_id) {
          const budgetTeam = Array.isArray(memberForBudget.teams)
            ? memberForBudget.teams[0]
            : memberForBudget.teams;
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
          const activeSalaries = (contracts ?? []).reduce(
            (sum, c) => sum + (c.locked_salary ?? 0),
            0,
          );
          const totalDraftBidsAmount = (draftBids ?? []).reduce(
            (sum, b) => sum + (b.amount ?? 0),
            0,
          );
          const draftBidsCount = (draftBids ?? []).length;

          let sponsorIncome = 0;
          if (sponsorData?.sponsors) {
            const sp = Array.isArray(sponsorData.sponsors)
              ? sponsorData.sponsors[0]
              : sponsorData.sponsors;
            sponsorIncome =
              (sp as { monthly_budget: number }).monthly_budget ?? 0;
          }

          const phaseConfirmedId =
            (budgetTeam as { phase_confirmed_id?: number | null })
              ?.phase_confirmed_id ?? null;
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
    }
  }

  // Owner info for ranking context
  if (context === "ranking") {
    const { data: ownerContract } = await supabase
      .from("contracts")
      .select("team_id, locked_salary, teams:team_id(name, league_id)")
      .eq("rider_id", riderId)
      .eq("status", "active")
      .maybeSingle();

    if (ownerContract) {
      const ownerTeam = Array.isArray(ownerContract.teams)
        ? ownerContract.teams[0]
        : ownerContract.teams;
      if (
        ownerTeam &&
        (ownerTeam as { league_id: string }).league_id === leagueId
      ) {
        const { data: ownerMember } = await supabase
          .from("league_members")
          .select("user_id, users(display_name)")
          .eq("team_id", ownerContract.team_id)
          .eq("league_id", leagueId)
          .maybeSingle();

        const ownerUser = ownerMember
          ? Array.isArray(ownerMember.users)
            ? ownerMember.users[0]
            : ownerMember.users
          : null;
        const displayName =
          (ownerUser as { display_name?: string })?.display_name ?? "Unknown";

        ownerInfo = {
          display_name: displayName,
          team_name: (ownerTeam as { name: string }).name,
          locked_salary: ownerContract.locked_salary ?? null,
        };
      }
    }
  }

  const minSalary = calcMinSalary(rider.pcs_points_1yr ?? 0);

  // Team-scoped totals for "team" context, global for market/ranking
  let gameXp: number;
  let totalBonus: number;
  const xpList = xpDailyRaw ?? [];
  const bonusList = sponsorBonusesRaw ?? [];

  if (context === "team" && userTeamId) {
    gameXp = xpList
      .filter((x) => x.team_id === userTeamId)
      .reduce((sum, x) => sum + (x.xp_gained ?? 0), 0);
    totalBonus = bonusList
      .filter((b) => b.team_id === userTeamId)
      .reduce((sum, b) => sum + (b.final_bonus ?? 0), 0);
  } else {
    gameXp = xpList.reduce(
      (sum, x) => sum + (x.xp_gained ?? 0),
      0,
    );
    totalBonus = bonusList.reduce(
      (sum, b) => sum + (b.final_bonus ?? 0),
      0,
    );
  }

  return {
    rider: {
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
    },
    rankings: (rankings ?? []).map((r) => ({
      rider_id: r.rider_id,
      season: r.season,
      points: r.points,
      rank: r.rank,
      team: teamBySeason[r.season] ?? null,
    })),
    startlists: (startlists ?? []).map((s) => ({
      race_name: s.race_name,
      race_date: s.race_date,
    })),
    raceResults,
    context,
    minSalary,
    currentBidId,
    currentBidAmount,
    activeAuctionId,
    contractData,
    ownerInfo,
    budgetInfo,
    gameXp,
    totalBonus,
    draftAmount,
    currentRound,
  };
}
