import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { redirect } from "next/navigation";
import { getDefaultStartingLevel } from "@/lib/levels";
import { LobbyPanels } from "./lobby-panels";
import { type LeagueMode } from "@/lib/league-mode";

export default async function LobbyPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const user = await getUser();
  if (!user) redirect("/login");

  const [
    { data: league },
    { data: rawMembers },
    { data: riders },
  ] = await Promise.all([
    supabase
      .from("leagues")
      .select("id, name, invite_code, commissioner_id, max_players, starting_level, mode")
      .eq("id", leagueId)
      .single(),
    supabase
      .from("league_members")
      .select("user_id, users(display_name, avatar_url), teams:team_id(name)")
      .eq("league_id", leagueId),
    supabase
      .from("riders")
      .select("id, full_name, pcs_rank, pcs_points_1yr")
      .eq("ever_in_pool", true)
      .gte("pcs_rank", 1)
      .lte("pcs_rank", 600)
      .order("pcs_rank", { ascending: true }),
  ]);

  if (!league) {
    return (
      <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        League not found.
      </p>
    );
  }

  const isCommissioner = league.commissioner_id === user.id;

  const members = (rawMembers ?? []).map((m) => ({
    user_id: m.user_id as string,
    users: Array.isArray(m.users) ? m.users[0] ?? null : m.users ?? null,
    teams: Array.isArray(m.teams)
      ? m.teams[0] ?? null
      : (m.teams as { name: string } | null) ?? null,
  }));

  const recommendedLevel = getDefaultStartingLevel();

  return (
    <LobbyPanels
      league={{
        id: league.id,
        name: league.name,
        invite_code: league.invite_code,
        commissioner_id: league.commissioner_id,
        max_players: league.max_players,
        starting_level: league.starting_level,
      }}
      members={members}
      memberCount={rawMembers?.length ?? 0}
      recommendedLevel={recommendedLevel}
      isCommissioner={isCommissioner}
      riders={(riders ?? []).map((r) => ({
        id: r.id as string,
        full_name: r.full_name as string,
        pcs_rank: r.pcs_rank as number,
        pcs_points_1yr: (r.pcs_points_1yr as number | null) ?? 0,
      }))}
      mode={((league.mode as string | null) ?? "manager") as LeagueMode}
    />
  );
}
