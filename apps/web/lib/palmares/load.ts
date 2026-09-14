import type { SupabaseClient } from "@supabase/supabase-js";
import { getAchievementBySlug, type AchievementTier } from "@/lib/achievements";
import { loadHistoricalPalmares } from "./historical";
import { loadCurrentSeason } from "./current";
import type { PalmaresEvent, SeasonStanding } from "./types";

/** Mirrors the archive reader's own rule, for the current season's rows. */
const HIDDEN_PLAYERS = new Set(["Fangio", "JoeDills"]);

export interface EquippedEmblem {
  badgeUrl: string;
  bannerUrl: string | null;
  tier: AchievementTier;
  name: string;
}

export interface PalmaresData {
  events: PalmaresEvent[];
  standings: SeasonStanding[];
  /** Equipped emblem per player, for the seasons that have one. */
  emblemByPlayer: Record<string, EquippedEmblem>;
  /** The signed-in player, used as the default of the Players tab. */
  viewerKey: string | null;
}

function visible<T extends { displayName: string }>(rows: T[]): T[] {
  return rows.filter((row) => !HIDDEN_PLAYERS.has(row.displayName));
}

export async function loadPalmares(
  supabase: SupabaseClient,
  options: { seasonYear: number; viewerKey?: string | null } ,
): Promise<PalmaresData> {
  const [historical, current] = await Promise.all([
    loadHistoricalPalmares(supabase),
    loadCurrentSeason(supabase, options.seasonYear),
  ]);

  const events = [...current.events, ...historical.events].map((event) => ({
    ...event,
    standings: visible(event.standings),
  }));

  const standings = [
    ...(current.standing ? [current.standing] : []),
    ...historical.standings,
  ]
    .map((season) => ({ ...season, ranking: visible(season.ranking) }))
    .sort((a, b) => b.seasonYear - a.seasonYear);

  // Equipped emblems come from the teams of the current season. A season played
  // before WattHunter gets initials instead — see firstWattHunterSeason.
  const emblemByPlayer: Record<string, EquippedEmblem> = {};
  const { data: leagueRows } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_year", options.seasonYear)
    .eq("is_demo", false)
    .neq("status", "pending");
  const leagueIds = (leagueRows ?? []).map((l) => l.id as string);

  if (leagueIds.length > 0) {
    const [{ data: teamRows }, { data: memberRows }] = await Promise.all([
      supabase
        .from("teams")
        .select("id, equipped_achievement_slug")
        .in("league_id", leagueIds),
      supabase
        .from("league_members")
        .select("team_id, users(display_name)")
        .in("league_id", leagueIds),
    ]);

    const nameByTeam = new Map<string, string>();
    for (const member of memberRows ?? []) {
      const teamId = member.team_id as string | null;
      if (!teamId) continue;
      const user = Array.isArray(member.users) ? member.users[0] : member.users;
      const displayName = (user as { display_name?: string })?.display_name;
      if (displayName) nameByTeam.set(teamId, displayName);
    }

    for (const team of teamRows ?? []) {
      const slug = (team as { equipped_achievement_slug?: string | null })
        .equipped_achievement_slug;
      const displayName = nameByTeam.get(team.id as string);
      if (!slug || !displayName || emblemByPlayer[displayName]) continue;
      const achievement = getAchievementBySlug(slug);
      if (!achievement?.badgeUrl) continue;
      emblemByPlayer[displayName] = {
        badgeUrl: achievement.badgeUrl,
        bannerUrl: achievement.bannerUrl ?? null,
        tier: achievement.tier,
        name: achievement.name,
      };
    }
  }

  return {
    events,
    standings,
    emblemByPlayer,
    viewerKey: options.viewerKey ?? null,
  };
}
