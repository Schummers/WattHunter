import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { MarketClient } from "./market-client";
import { getLevelByNumber, getMaxSlots } from "@/lib/levels";
import { isClassic, CLASSIC_SQUAD_SIZE, type LeagueMode } from "@/lib/league-mode";
import { getNextAuctionDate, formatAuctionDate, getCurrentPhase } from "@/lib/phases";
import { buildCoUnlockChecker } from "@/lib/co-unlock";
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

export default async function MarketPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoAuctionMarket();

  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return (
      <div className="px-4 py-8">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          Please sign in to view the market.
        </p>
      </div>
    );
  }

  const { data: member } = await supabase
    .from("league_members")
    .select(
      "id, team_id, teams:team_id(id, level, cumulative_xp, treasury, phase_confirmed_id)"
    )
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return (
      <div className="px-4 py-8">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          You are not a member of this league.
        </p>
      </div>
    );
  }

  const team = Array.isArray(member.teams) ? member.teams[0] : member.teams;
  const level = team?.level ?? 1;
  const minRank = getLevelByNumber(level).poolMin;
  const checkLock = await buildCoUnlockChecker(leagueId);
  const phaseConfirmedId = (team as { phase_confirmed_id?: number | null })?.phase_confirmed_id ?? null;
  const phaseConfirmed = phaseConfirmedId === getCurrentPhase().id;

  // Classic mode: fixed squad size (CLASSIC_SQUAD_SIZE) regardless of level (matches the place_bid backend cap).
  const { data: league } = await supabase
    .from("leagues")
    .select("mode")
    .eq("id", leagueId)
    .single();
  const leagueMode = (league?.mode ?? "manager") as LeagueMode;
  const maxSlots = isClassic(leagueMode) ? CLASSIC_SQUAD_SIZE : getMaxSlots(level);

  const [
    { data: riders },
    { data: leagueTeams },
    { data: tdfStartlist },
  ] = await Promise.all([
    supabase
      .from("riders")
      .select(
        "id, full_name, nationality, real_team, pcs_rank, pcs_rank_prev, photo_url, specialty, pcs_points_1yr, birthdate"
      )
      .gte("pcs_rank", minRank)
      .lte("pcs_rank", 600)
      .order("pcs_rank", { ascending: true })
      .limit(600),
    supabase.from("teams").select("id").eq("league_id", leagueId),
    supabase
      .from("race_startlists")
      .select("rider_id")
      .eq("race_slug", "race/tour-de-france/2026"),
  ]);

  const leagueTeamIds = (leagueTeams ?? []).map((t) => t.id);

  const { data: leagueContracts } = await supabase
    .from("contracts")
    .select("rider_id, team_id, locked_salary")
    .in("team_id", leagueTeamIds)
    .eq("status", "active");

  const ownedRiderIds = new Set(
    (leagueContracts ?? []).map((c) => c.rider_id)
  );

  const ownTeamContracts = (leagueContracts ?? []).filter(
    (c) => c.team_id === team?.id
  );
  const ownTeamSlots = ownTeamContracts.length;
  const activeSalaries = ownTeamContracts.reduce(
    (sum, c) => sum + (c.locked_salary ?? 0),
    0
  );

  const availableRiders = (riders ?? [])
    .filter((r) => !ownedRiderIds.has(r.id))
    .map((r) => {
      const status = checkLock(r.pcs_rank ?? null);
      return {
        ...r,
        pcs_rank_diff:
          r.pcs_rank != null && r.pcs_rank_prev != null
            ? r.pcs_rank_prev - r.pcs_rank
            : null,
        isLocked: !status.isUnlocked,
        lockMinLevel: status.minLevel,
        lockPlayersAtLevel: status.playersAtOrAboveLevel,
        lockPlayersRequired: status.playersRequired,
      };
    });

  const [
    { data: activeRound },
    { data: scheduledRoundData },
    { count: closedCount },
  ] = await Promise.all([
    supabase
      .from("auctions")
      .select("id, name, opens_at, closes_at")
      .eq("league_id", leagueId)
      .eq("status", "open")
      .order("opens_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("auctions")
      .select("id, name, opens_at")
      .eq("league_id", leagueId)
      .eq("status", "scheduled")
      .order("opens_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("auctions")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .eq("status", "closed"),
  ]);

  let nextRound: { id: string; name: string; opens_at: string } | null = null;
  let nextAuctionLabel: string | null = null;
  if (!activeRound) {
    nextRound = scheduledRoundData;
    if (!nextRound) {
      if (closedCount && closedCount > 0) {
        const next = getNextAuctionDate();
        if (next) {
          nextAuctionLabel = `Next round · ${formatAuctionDate(next.date)}`;
        }
      }
    }
  }

  // Fetch the user's draft bids (rider_id + amount)
  let draftBidMap: { riderId: string; amount: number }[] = [];
  let sponsorIncome = 0;
  
  if (team?.id) {
    const [
      { data: draftBids },
      { data: sponsorData }
    ] = await Promise.all([
      supabase
        .from("draft_bids")
        .select("rider_id, amount")
        .eq("team_id", team.id),
      supabase
        .from("team_sponsors")
        .select("sponsors(monthly_budget)")
        .eq("team_id", team.id)
        .maybeSingle()
    ]);
    
    draftBidMap = (draftBids ?? []).map((d) => ({
      riderId: d.rider_id,
      amount: d.amount,
    }));
    
    if (sponsorData?.sponsors) {
      const sp = Array.isArray(sponsorData.sponsors) ? sponsorData.sponsors[0] : sponsorData.sponsors;
      sponsorIncome = (sp as { monthly_budget: number }).monthly_budget ?? 0;
    }
  }

  const tdfRiderIds = (tdfStartlist ?? []).map((s) => s.rider_id);

  return (
    <MarketClient
      leagueId={leagueId}
      riders={availableRiders}
      activeRound={activeRound}
      nextRound={nextRound}
      nextAuctionLabel={nextAuctionLabel}
      maxSlots={maxSlots}
      currentSlots={ownTeamSlots}
      treasury={team?.treasury ?? 0}
      sponsorIncome={sponsorIncome}
      activeSalaries={activeSalaries}
      phaseConfirmed={phaseConfirmed}
      draftBids={draftBidMap}
      tdfRiderIds={tdfRiderIds}
      mode={leagueMode}
    />
  );
}

// ---------------------------------------------------------------------------
// Demo path — anonymous visitor, no auth required
// ---------------------------------------------------------------------------
async function renderDemoAuctionMarket() {
  const supabase = await createClient();
  const teamId = DEMO_VISITOR_TEAM_ID;
  const leagueId = DEMO_LEAGUE_ID;

  const { data: teamRow } = await supabase
    .from("teams")
    .select("id, level, cumulative_xp, treasury, phase_confirmed_id")
    .eq("id", teamId)
    .single();

  const level = teamRow?.level ?? 1;
  const minRank = getLevelByNumber(level).poolMin;
  const checkLock = await buildCoUnlockChecker(leagueId);
  const phaseConfirmedId = (teamRow as { phase_confirmed_id?: number | null })?.phase_confirmed_id ?? null;
  const phaseConfirmed = phaseConfirmedId === getCurrentPhase().id;

  const [
    { data: riders },
    { data: leagueTeams },
    { data: tdfStartlist },
  ] = await Promise.all([
    supabase
      .from("riders")
      .select(
        "id, full_name, nationality, real_team, pcs_rank, pcs_rank_prev, photo_url, specialty, pcs_points_1yr, birthdate"
      )
      .gte("pcs_rank", minRank)
      .lte("pcs_rank", 600)
      .order("pcs_rank", { ascending: true })
      .limit(600),
    supabase.from("teams").select("id").eq("league_id", leagueId),
    supabase
      .from("race_startlists")
      .select("rider_id")
      .eq("race_slug", "race/tour-de-france/2026"),
  ]);

  const leagueTeamIds = (leagueTeams ?? []).map((t) => t.id);

  const { data: leagueContracts } = await supabase
    .from("contracts")
    .select("rider_id, team_id, locked_salary")
    .in("team_id", leagueTeamIds)
    .eq("status", "active");

  const ownedRiderIds = new Set((leagueContracts ?? []).map((c) => c.rider_id));
  const ownTeamContracts = (leagueContracts ?? []).filter((c) => c.team_id === teamId);
  const ownTeamSlots = ownTeamContracts.length;
  const activeSalaries = ownTeamContracts.reduce((sum, c) => sum + (c.locked_salary ?? 0), 0);

  const availableRiders = (riders ?? [])
    .filter((r) => !ownedRiderIds.has(r.id))
    .map((r) => {
      const status = checkLock(r.pcs_rank ?? null);
      return {
        ...r,
        pcs_rank_diff:
          r.pcs_rank != null && r.pcs_rank_prev != null ? r.pcs_rank_prev - r.pcs_rank : null,
        isLocked: !status.isUnlocked,
        lockMinLevel: status.minLevel,
        lockPlayersAtLevel: status.playersAtOrAboveLevel,
        lockPlayersRequired: status.playersRequired,
      };
    });

  const [
    { data: activeRound },
    { data: scheduledRoundData },
    { count: closedCount },
  ] = await Promise.all([
    supabase
      .from("auctions")
      .select("id, name, opens_at, closes_at")
      .eq("league_id", leagueId)
      .eq("status", "open")
      .order("opens_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("auctions")
      .select("id, name, opens_at")
      .eq("league_id", leagueId)
      .eq("status", "scheduled")
      .order("opens_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("auctions")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .eq("status", "closed"),
  ]);

  let nextRound: { id: string; name: string; opens_at: string } | null = null;
  let nextAuctionLabel: string | null = null;
  if (!activeRound) {
    nextRound = scheduledRoundData;
    if (!nextRound) {
      if (closedCount && closedCount > 0) {
        const next = getNextAuctionDate();
        if (next) {
          nextAuctionLabel = `Next round · ${formatAuctionDate(next.date)}`;
        }
      }
    }
  }

  const [{ data: draftBids }, { data: sponsorData }] = await Promise.all([
    supabase.from("draft_bids").select("rider_id, amount").eq("team_id", teamId),
    supabase
      .from("team_sponsors")
      .select("sponsors(monthly_budget)")
      .eq("team_id", teamId)
      .maybeSingle(),
  ]);

  const draftBidMap = (draftBids ?? []).map((d) => ({ riderId: d.rider_id, amount: d.amount }));

  let sponsorIncome = 0;
  if (sponsorData?.sponsors) {
    const sp = Array.isArray(sponsorData.sponsors) ? sponsorData.sponsors[0] : sponsorData.sponsors;
    sponsorIncome = (sp as { monthly_budget: number }).monthly_budget ?? 0;
  }

  const tdfRiderIds = (tdfStartlist ?? []).map((s) => s.rider_id);

  return (
    <MarketClient
      leagueId={DEMO_LEAGUE_SLUG}
      riders={availableRiders}
      activeRound={activeRound}
      nextRound={nextRound}
      nextAuctionLabel={nextAuctionLabel}
      maxSlots={getMaxSlots(level)}
      currentSlots={ownTeamSlots}
      treasury={teamRow?.treasury ?? 0}
      sponsorIncome={sponsorIncome}
      activeSalaries={activeSalaries}
      phaseConfirmed={phaseConfirmed}
      draftBids={draftBidMap}
      tdfRiderIds={tdfRiderIds}
    />
  );
}
