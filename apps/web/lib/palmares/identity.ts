import type { SupabaseClient } from "@supabase/supabase-js";
import { getAchievementBySlug, type AchievementTier } from "@/lib/achievements";

export interface EquippedEmblem {
  badgeUrl: string;
  bannerUrl: string | null;
  tier: AchievementTier;
  name: string;
}

/** How a player is presented today, whatever season is on screen. */
export interface PlayerIdentity {
  /** The player's current team name. Falls back to the account name. */
  label: string;
  /** The badge equipped on that team, or null when none is. */
  emblem: EquippedEmblem | null;
}

/**
 * Player identity, keyed on the account display name.
 *
 * The key stays the account name because it is the only bridge between the two
 * eras — a closed archive carries no user id. What this resolves is the *label*:
 * the name the player goes by today, which is their team name. Before this, the
 * Ranking showed "GoudalEnergies" in 2026 and "David Choncoutié" in 2025, and
 * nobody recognised themselves one year away from the current one.
 *
 * The badge is read the same way, and is deliberately today's badge on a 2019
 * row: name and badge say who this player *is*, not what they had equipped in a
 * game that did not exist yet. Ranks are the opposite — always the original
 * ones, never recomputed (see docs/adr).
 */
export async function loadPlayerIdentities(
  supabase: SupabaseClient,
  options: { seasonYear: number; preferLeagueId?: string | null },
): Promise<Map<string, PlayerIdentity>> {
  const identities = new Map<string, PlayerIdentity>();

  const { data: leagueRows } = await supabase
    .from("leagues")
    .select("id, created_at")
    // Same perimeter as the season standings: not the demo, which would inject
    // eight fictional players, and not a league that was never launched.
    .eq("season_year", options.seasonYear)
    .eq("is_demo", false)
    .neq("status", "pending");

  const leagues = leagueRows ?? [];
  if (leagues.length === 0) return identities;

  const leagueIds = leagues.map((l) => l.id as string);
  const leagueRank = new Map<string, number>();
  const ordered = [...leagues].sort((a, b) =>
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")),
  );
  ordered.forEach((league, index) => leagueRank.set(league.id as string, index));
  // The league being browsed wins over every other one: on the Ranking of league
  // V1, a player who renamed their team in V2 still reads under their V1 name.
  if (options.preferLeagueId && leagueRank.has(options.preferLeagueId)) {
    leagueRank.set(options.preferLeagueId, ordered.length);
  }

  const [{ data: teamRows }, { data: memberRows }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, league_id, name, equipped_achievement_slug")
      .in("league_id", leagueIds),
    supabase
      .from("league_members")
      .select("team_id, users(display_name)")
      .in("league_id", leagueIds),
  ]);

  const accountByTeam = new Map<string, string>();
  for (const member of memberRows ?? []) {
    const teamId = member.team_id as string | null;
    if (!teamId) continue;
    const user = Array.isArray(member.users) ? member.users[0] : member.users;
    const displayName = (user as { display_name?: string })?.display_name;
    if (displayName) accountByTeam.set(teamId, displayName);
  }

  // One team per player: the one from the preferred league, otherwise the one
  // from the most recently created league of the season.
  const chosen = new Map<string, { rank: number; name: string; slug: string | null }>();
  for (const team of teamRows ?? []) {
    const account = accountByTeam.get(team.id as string);
    if (!account) continue;
    const rank = leagueRank.get(team.league_id as string) ?? -1;
    const current = chosen.get(account);
    if (current && current.rank >= rank) continue;
    chosen.set(account, {
      rank,
      name: (team.name as string | null) ?? account,
      slug:
        (team as { equipped_achievement_slug?: string | null })
          .equipped_achievement_slug ?? null,
    });
  }

  for (const [account, team] of chosen) {
    const achievement = team.slug ? getAchievementBySlug(team.slug) : undefined;
    identities.set(account, {
      label: team.name,
      emblem: achievement?.badgeUrl
        ? {
            badgeUrl: achievement.badgeUrl,
            bannerUrl: achievement.bannerUrl ?? null,
            tier: achievement.tier,
            name: achievement.name,
          }
        : null,
    });
  }

  return identities;
}
