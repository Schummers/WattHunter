import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { MarketClient } from "./market-client";
import { getLevelByNumber, getMaxSlots, getLevelForXp } from "@/lib/levels";
import { getNextAuctionDate, formatAuctionDate } from "@/lib/phases";

export default async function MarketPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
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
      "id, team_id, teams:team_id(id, level, cumulative_xp, treasury)"
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
  const xp = team?.cumulative_xp ?? 0;
  const level = getLevelForXp(xp);
  const minRank = getLevelByNumber(level).poolMin;

  const [
    { data: riders },
    { data: leagueTeams },
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
  ]);

  const leagueTeamIds = (leagueTeams ?? []).map((t) => t.id);

  const { data: leagueContracts } = await supabase
    .from("contracts")
    .select("rider_id, team_id")
    .in("team_id", leagueTeamIds)
    .eq("status", "active");

  const ownedRiderIds = new Set(
    (leagueContracts ?? []).map((c) => c.rider_id)
  );

  const ownTeamSlots = (leagueContracts ?? []).filter(
    (c) => c.team_id === team?.id
  ).length;

  const availableRiders = (riders ?? [])
    .filter((r) => !ownedRiderIds.has(r.id))
    .map((r) => ({
      ...r,
      pcs_rank_diff:
        r.pcs_rank != null && r.pcs_rank_prev != null
          ? r.pcs_rank_prev - r.pcs_rank
          : null,
    }));

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
  if (team?.id) {
    const { data: draftBids } = await supabase
      .from("draft_bids")
      .select("rider_id, amount")
      .eq("team_id", team.id);
    draftBidMap = (draftBids ?? []).map((d) => ({
      riderId: d.rider_id,
      amount: d.amount,
    }));
  }

  return (
    <MarketClient
      leagueId={leagueId}
      riders={availableRiders}
      activeRound={activeRound}
      nextRound={nextRound}
      nextAuctionLabel={nextAuctionLabel}
      maxSlots={getMaxSlots(level)}
      currentSlots={ownTeamSlots}
      treasury={team?.treasury ?? 0}
      draftBids={draftBidMap}
    />
  );
}
