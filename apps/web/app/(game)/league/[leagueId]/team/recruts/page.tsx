import { createClient } from "@/lib/supabase/server";
import { RecrutsClient } from "./recruts-client";

const LEVEL_POOL: Record<number, number> = {
  1: 401,
  2: 301,
  3: 201,
  4: 151,
  5: 101,
  6: 76,
  7: 51,
  8: 26,
  9: 11,
  10: 1,
};

function getMinRank(level: number): number {
  return LEVEL_POOL[level] ?? 401;
}

export default async function RecrutsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="px-4 py-8">
        <p className="text-sm text-[var(--text-mid)]">
          Please sign in to view recruts.
        </p>
      </div>
    );
  }

  const { data: member } = await supabase
    .from("league_members")
    .select("id, team_id, teams:team_id(id, level, cumulative_xp)")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return (
      <div className="px-4 py-8">
        <p className="text-sm text-[var(--text-mid)]">
          You are not a member of this league.
        </p>
      </div>
    );
  }

  const team = Array.isArray(member.teams) ? member.teams[0] : member.teams;
  const level = team?.level ?? 1;
  const minRank = getMinRank(level);

  // Fetch available riders within pool range
  const { data: riders } = await supabase
    .from("riders")
    .select(
      "id, full_name, nationality, real_team, pcs_rank, photo_url, specialty, pcs_points_1yr"
    )
    .gte("pcs_rank", minRank)
    .lte("pcs_rank", 500)
    .order("pcs_rank", { ascending: true })
    .limit(500);

  // Fetch current team rider IDs to exclude them
  const { data: teamRiders } = await supabase
    .from("contracts")
    .select("rider_id")
    .eq("team_id", team?.id)
    .in("status", ["active", "notice"]);

  const ownedRiderIds = new Set(
    (teamRiders ?? []).map((tr) => tr.rider_id)
  );

  const availableRiders = (riders ?? []).filter(
    (r) => !ownedRiderIds.has(r.id)
  );

  // Get current active auction (if any)
  const { data: activeRound } = await supabase
    .from("auctions")
    .select("id, name, opens_at, closes_at")
    .eq("league_id", leagueId)
    .eq("status", "open")
    .order("opens_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
      maxSlots={
        [6, 7, 7, 8, 9, 9, 10, 11, 11, 12][Math.min(level, 10) - 1]
      }
      currentSlots={(teamRiders ?? []).length}
      initialBids={initialBids}
    />
  );
}
