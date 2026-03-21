import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { RecrutsClient } from "./recruts-client";
import { getLevelByNumber, getMaxSlots, getLevelForXp } from "@/lib/levels";
import { getNextAuctionDate, formatAuctionDate } from "@/lib/phases";

export default async function RecrutsPage({
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
          Please sign in to view recruts.
        </p>
      </div>
    );
  }

  const { data: member } = await supabase
    .from("league_members")
    .select("id, team_id, teams:team_id(id, level, cumulative_xp, treasury)")
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

  // Parallelize: riders and leagueTeams are independent of each other
  const [{ data: riders }, { data: leagueTeams }] = await Promise.all([
    supabase
      .from("riders")
      .select(
        "id, full_name, nationality, real_team, pcs_rank, pcs_rank_prev, photo_url, specialty, pcs_points_1yr"
      )
      .gte("pcs_rank", minRank)
      .lte("pcs_rank", 500)
      .order("pcs_rank", { ascending: true })
      .limit(500),
    supabase
      .from("teams")
      .select("id")
      .eq("league_id", leagueId),
  ]);

  const leagueTeamIds = (leagueTeams ?? []).map((t) => t.id);

  const { data: leagueContracts } = await supabase
    .from("contracts")
    .select("rider_id, team_id")
    .in("team_id", leagueTeamIds)
    .in("status", ["active", "notice"]);

  const ownedRiderIds = new Set(
    (leagueContracts ?? []).map((c) => c.rider_id)
  );

  // Count own team contracts for currentSlots
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

  // Parallelize: all three auction-status queries are independent of each other
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

  // If no active round, find next scheduled
  let nextRound: { id: string; name: string; opens_at: string } | null = null;
  let nextAuctionLabel: string | null = null;
  if (!activeRound) {
    nextRound = scheduledRoundData;

    // If no scheduled auction, check if season has started (any closed auction exists)
    if (!nextRound) {
      if (closedCount && closedCount > 0) {
        // Season started — calculate next from calendar
        const next = getNextAuctionDate();
        if (next) {
          nextAuctionLabel = `Next round · ${formatAuctionDate(next.date)}`;
        }
      }
    }
  }

  // Load existing bids for this user's team in the active auction
  let initialBids: Array<{ bid_id: string; rider_id: string; amount: number }> = [];
  if (activeRound && team?.id) {
    const { data: existingBids } = await supabase
      .from("auction_bids")
      .select("id, rider_id, amount")
      .eq("team_id", team.id)
      .eq("auction_id", activeRound.id)
      .eq("status", "active");

    initialBids = (existingBids ?? []).map((b) => ({
      bid_id: b.id,
      rider_id: b.rider_id,
      amount: b.amount,
    }));
  }

  return (
    <RecrutsClient
      leagueId={leagueId}
      riders={availableRiders}
      activeRound={activeRound}
      nextRound={nextRound}
      nextAuctionLabel={nextAuctionLabel}
      maxSlots={getMaxSlots(level)}
      currentSlots={ownTeamSlots}
      initialBids={initialBids}
      treasury={team?.treasury ?? 200000}
    />
  );
}
