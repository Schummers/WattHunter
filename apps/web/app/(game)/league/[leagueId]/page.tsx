import { Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LobbyView } from "./lobby-view";
import { HomeGtBanner } from "@/components/home-gt-banner";
import { RaceFeed } from "@/components/race-feed";
import { getRaceFeedData } from "@/lib/get-race-feed-data";

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

  // --- Active league: load race feed ---

  const { count: closedCount } = await supabase
    .from("auctions")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueId)
    .eq("status", "closed");

  const { data: memberRow } = await supabase
    .from("league_members")
    .select("team_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  const teamId = memberRow?.team_id ?? null;

  const { data: teamSponsorRow } = teamId
    ? await supabase
        .from("team_sponsors")
        .select("id")
        .eq("team_id", teamId)
        .maybeSingle()
    : { data: null };

  const isLateJoinPending = teamSponsorRow === null && (closedCount ?? 0) > 0;

  const raceFeedPayload = teamId
    ? await getRaceFeedData(supabase, { leagueId, myTeamId: teamId })
    : { groups: [], nextPhaseRound1Date: null, nextPhaseLabel: null };

  return (
    <>
      <HomeGtBanner leagueId={leagueId} />
      {isLateJoinPending && (
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-[var(--text-mid)]" />
          <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            You joined mid-season. You can select your sponsor and start bidding at the next auction phase.
          </p>
        </div>
      )}
      <RaceFeed leagueId={leagueId} payload={raceFeedPayload} />
    </>
  );
}
