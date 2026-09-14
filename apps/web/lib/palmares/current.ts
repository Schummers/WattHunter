import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllSupabasePages } from "@/lib/supabase-pagination";
import { RACE_GROUP_IDS, getRaceGroupId, getRaceGroupWindow, type RaceGroupId } from "@/lib/race-groups";
import { JERSEYS, type JerseyId, type PalmaresEvent, type Player, type SeasonStanding } from "./types";

/** Which traceability column decides each jersey (migration 20260914000100). */
const JERSEY_COLUMN: Record<JerseyId, string> = {
  yel: "gc_classif_bonus",
  grn: "points_classif_bonus",
  pol: "kom_classif_bonus",
  wht: "youth_classif_bonus",
};

/** A final classification row carries exactly one jersey, readable off its slug. */
const FINAL_SLUG_JERSEY: Record<string, JerseyId> = {
  gc: "yel",
  points: "grn",
  kom: "pol",
  youth: "wht",
};

function finalJerseyOf(raceSlug: string): JerseyId | null {
  return FINAL_SLUG_JERSEY[raceSlug.split("/").pop() ?? ""] ?? null;
}

interface XpRow {
  team_id: string;
  race_slug: string | null;
  xp_gained: number | null;
  gc_classif_bonus: number | null;
  points_classif_bonus: number | null;
  kom_classif_bonus: number | null;
  youth_classif_bonus: number | null;
}

export interface CurrentSeason {
  events: PalmaresEvent[];
  standing: SeasonStanding | null;
}

/**
 * A WattHunter season, in the same shape the archive produces.
 *
 * Aggregated BY PLAYER across every league of the year: the two 2026 classic
 * leagues (V1 carried the Classics and the Giro, V2 the Tour and the Vuelta) are
 * the same group of people under two team names.
 *
 * RLS scopes this to the leagues the caller belongs to. In a group where
 * everyone plays the same leagues that is the whole field; it is not a
 * cross-account view of strangers.
 */
export async function loadCurrentSeason(
  supabase: SupabaseClient,
  seasonYear: number,
  today = new Date().toISOString().slice(0, 10),
): Promise<CurrentSeason> {
  const { data: leagueRows } = await supabase
    .from("leagues")
    .select("id")
    .eq("season_year", seasonYear)
    // A season is made of the leagues the group actually played. Not the demo,
    // which is the public shop window and would inject eight fictional players
    // into the group's own standing, and not a league still pending, which has
    // never been launched.
    .eq("is_demo", false)
    .neq("status", "pending");

  const leagueIds = (leagueRows ?? []).map((l) => l.id as string);
  if (leagueIds.length === 0) return { events: [], standing: null };

  const [{ data: teamRows }, { data: memberRows }] = await Promise.all([
    supabase.from("teams").select("id, league_id").in("league_id", leagueIds),
    supabase
      .from("league_members")
      .select("team_id, user_id, users(display_name)")
      .in("league_id", leagueIds),
  ]);

  const teamIds = (teamRows ?? []).map((t) => t.id as string);
  if (teamIds.length === 0) return { events: [], standing: null };

  // team -> the player who owns it. A player owning a team in each league
  // collapses into one entry, which is the whole point of keying on the account.
  const playerByTeam = new Map<string, Player>();
  for (const member of memberRows ?? []) {
    const teamId = member.team_id as string | null;
    if (!teamId) continue;
    const user = Array.isArray(member.users) ? member.users[0] : member.users;
    const displayName = (user as { display_name?: string })?.display_name ?? "Unknown";
    playerByTeam.set(teamId, { key: displayName, displayName, isFormerPlayer: false });
  }

  const xpRows = await fetchAllSupabasePages<XpRow>((from, to) =>
    supabase
      .from("rider_xp_daily")
      .select(
        "team_id, race_slug, xp_gained, gc_classif_bonus, points_classif_bonus, kom_classif_bonus, youth_classif_bonus",
      )
      .in("team_id", teamIds)
      .order("id")
      .range(from, to),
  );

  const seasonXp = new Map<string, { player: Player; xp: number }>();
  const xpByGroup = new Map<RaceGroupId, Map<string, { player: Player; xp: number }>>();
  const jerseyPoints = new Map<RaceGroupId, Map<JerseyId, Map<string, { player: Player; points: number }>>>();

  for (const row of xpRows) {
    const player = playerByTeam.get(row.team_id);
    if (!player) continue;
    const xp = Number(row.xp_gained ?? 0);

    const seasonEntry = seasonXp.get(player.key);
    if (seasonEntry) seasonEntry.xp += xp;
    else seasonXp.set(player.key, { player, xp });

    const groupId = row.race_slug ? getRaceGroupId(row.race_slug) : null;
    if (!groupId) continue;

    let groupXp = xpByGroup.get(groupId);
    if (!groupXp) {
      groupXp = new Map();
      xpByGroup.set(groupId, groupXp);
    }
    const groupEntry = groupXp.get(player.key);
    if (groupEntry) groupEntry.xp += xp;
    else groupXp.set(player.key, { player, xp });

    // Classics award no jersey: a one-day race has none.
    if (groupId === "classics") continue;
    let byJersey = jerseyPoints.get(groupId);
    if (!byJersey) {
      byJersey = new Map();
      jerseyPoints.set(groupId, byJersey);
    }
    const addJerseyPoints = (jersey: JerseyId, points: number) => {
      if (points === 0) return;
      let byPlayer = byJersey.get(jersey);
      if (!byPlayer) {
        byPlayer = new Map();
        byJersey.set(jersey, byPlayer);
      }
      const entry = byPlayer.get(player.key);
      if (entry) entry.points += points;
      else byPlayer.set(player.key, { player, points });
    };

    // A final classification row belongs whole to its jersey — separated by its
    // slug, so it needs no traceability column and stays right even on a Grand
    // Tour scored under a scale that no longer exists (the Giro 2026).
    const finalJersey = row.race_slug ? finalJerseyOf(row.race_slug) : null;
    if (finalJersey) {
      addJerseyPoints(finalJersey, xp);
      continue;
    }

    for (const jersey of JERSEYS) {
      addJerseyPoints(
        jersey,
        Number((row as unknown as Record<string, number | null>)[JERSEY_COLUMN[jersey]] ?? 0),
      );
    }
  }

  const events: PalmaresEvent[] = RACE_GROUP_IDS.map((eventType) => {
    const groupXp = xpByGroup.get(eventType);
    const window = getRaceGroupWindow(eventType, seasonYear);
    const hasResults = groupXp !== undefined && groupXp.size > 0;

    let status: PalmaresEvent["status"];
    if (hasResults) {
      status = window && today <= window.end ? "ongoing" : "played";
    } else if (window && today < window.start) {
      status = "upcoming";
    } else {
      status = "not-played";
    }

    const standings = hasResults
      ? [...groupXp.values()]
          .sort((a, b) => b.xp - a.xp)
          .map((entry, index) => ({ ...entry.player, rank: index + 1 }))
      : [];

    const jerseys: Partial<Record<JerseyId, Player>> = {};
    if (status === "played") {
      const byJersey = jerseyPoints.get(eventType);
      for (const jersey of JERSEYS) {
        const byPlayer = byJersey?.get(jersey);
        if (!byPlayer || byPlayer.size === 0) continue;
        const best = [...byPlayer.values()].sort((a, b) => b.points - a.points)[0];
        if (best.points > 0) jerseys[jersey] = best.player;
      }
    }

    return { seasonYear, eventType, status, standings, jerseys };
  });

  const ranking = [...seasonXp.values()]
    .sort((a, b) => b.xp - a.xp)
    .map((entry) => ({ ...entry.player, score: entry.xp }));

  const playedCount = events.filter((e) => e.status === "played" || e.status === "ongoing").length;
  const isCurrent = events.some((e) => e.status === "ongoing" || e.status === "upcoming");

  return {
    events,
    standing: ranking.length === 0 ? null : {
      seasonYear,
      source: "watthunter" as const,
      isCurrent,
      note: isCurrent ? `${playedCount} of ${RACE_GROUP_IDS.length} phases` : null,
      ranking,
    },
  };
}
