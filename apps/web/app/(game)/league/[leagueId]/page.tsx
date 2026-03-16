import { createClient } from "@/lib/supabase/server";
import { LobbyView } from "./lobby-view";
import { HomeFeed } from "./home-feed";
import { getNextAuctionDate, formatAuctionDate } from "@/lib/phases";


export default async function LeagueDashboardPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: league }, { data: members }, { count: memberCount }] =
    await Promise.all([
      supabase
        .from("leagues")
        .select("id, name, invite_code, commissioner_id, status, max_players")
        .eq("id", leagueId)
        .single(),
      supabase
        .from("league_members")
        .select("user_id, users(display_name, avatar_url), teams:team_id(name)")
        .eq("league_id", leagueId),
      supabase
        .from("league_members")
        .select("id", { count: "exact", head: true })
        .eq("league_id", leagueId),
    ]);

  if (!league || !user) {
    return <p className="text-[var(--text-mid)]">League not found.</p>;
  }

  const isCommissioner = league.commissioner_id === user.id;
  const isPending = league.status === "pending";

  if (isPending) {
    const normalizedMembers = (members ?? []).map((m) => ({
      user_id: m.user_id as string,
      users: Array.isArray(m.users) ? m.users[0] ?? null : m.users ?? null,
      teams: Array.isArray(m.teams) ? m.teams[0] ?? null : (m.teams as { name: string } | null) ?? null,
    }));

    return (
      <LobbyView
        league={league}
        members={normalizedMembers}
        memberCount={memberCount ?? 0}
        isCommissioner={isCommissioner}
      />
    );
  }

  // --- Active league: fetch home feed data ---

  // Active / upcoming auction
  const { data: activeAuction } = await supabase
    .from("auctions")
    .select("id, name, status, opens_at, closes_at")
    .eq("league_id", leagueId)
    .in("status", ["open", "scheduled"])
    .order("opens_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // If no active/scheduled auction, check if season started for calendar fallback
  let nextAuctionLabel: string | null = null;
  if (!activeAuction) {
    const { count: closedCount } = await supabase
      .from("auctions")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .eq("status", "closed");

    if (closedCount && closedCount > 0) {
      const next = getNextAuctionDate();
      if (next) {
        nextAuctionLabel = formatAuctionDate(next.date);
      }
    }
  }

  return (
    <HomeFeed
      leagueId={leagueId}
      activeAuction={activeAuction}
      nextAuctionLabel={nextAuctionLabel}
    />
  );
}
