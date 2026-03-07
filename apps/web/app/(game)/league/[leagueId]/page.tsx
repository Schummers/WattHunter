import { createClient } from "@/lib/supabase/server";
import { LobbyView } from "./lobby-view";

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
        .select("user_id, users(display_name, avatar_url)")
        .eq("league_id", leagueId),
      supabase
        .from("league_members")
        .select("id", { count: "exact", head: true })
        .eq("league_id", leagueId),
    ]);

  if (!league || !user) {
    return <p className="text-muted-foreground">League not found.</p>;
  }

  const isCommissioner = league.commissioner_id === user.id;
  const isPending = league.status === "pending";

  if (isPending) {
    const normalizedMembers = (members ?? []).map((m) => ({
      user_id: m.user_id as string,
      users: Array.isArray(m.users) ? m.users[0] ?? null : m.users ?? null,
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

  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">Dashboard</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The league is active. Auctions and rankings coming soon.
      </p>
    </div>
  );
}
