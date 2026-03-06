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
    .select("id, level, xp")
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

  const level = member.level ?? 1;
  const minRank = getMinRank(level);

  // Fetch available riders within pool range
  const { data: riders } = await supabase
    .from("riders")
    .select(
      "id, full_name, nationality, team_name, pcs_rank, photo_url, specialty, pcs_points_1yr"
    )
    .gte("pcs_rank", minRank)
    .lte("pcs_rank", 500)
    .order("pcs_rank", { ascending: true })
    .limit(500);

  // Fetch current team rider IDs to exclude them
  const { data: teamRiders } = await supabase
    .from("team_riders")
    .select("rider_id")
    .eq("league_member_id", member.id)
    .eq("status", "active");

  const ownedRiderIds = new Set(
    (teamRiders ?? []).map((tr) => tr.rider_id)
  );

  const availableRiders = (riders ?? []).filter(
    (r) => !ownedRiderIds.has(r.id)
  );

  // Get current active auction round (if any)
  const { data: activeRound } = await supabase
    .from("auction_rounds")
    .select("id, round_number, opens_at, closes_at")
    .eq("league_id", leagueId)
    .eq("status", "open")
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <RecrutsClient
      leagueId={leagueId}
      riders={availableRiders}
      activeRound={activeRound}
      maxSlots={
        [6, 7, 7, 8, 9, 9, 10, 11, 11, 12][Math.min(level, 10) - 1]
      }
      currentSlots={(teamRiders ?? []).length}
    />
  );
}
