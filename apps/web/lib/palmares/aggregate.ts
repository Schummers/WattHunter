import { RACE_GROUP_IDS, type RaceGroupId } from "@/lib/race-groups";
import { JERSEYS, type JerseyId, type PalmaresEvent, type Player, type SeasonStanding } from "./types";

export interface PlayerWins extends Player {
  /** Counts of 1st, 2nd and 3rd places, in that order. */
  podium: [number, number, number];
  starts: number;
  wins: number;
  winsByEvent: Record<RaceGroupId, number>;
}

export interface PlayerJerseys extends Player {
  byJersey: Record<JerseyId, number>;
  total: number;
}

export interface PlayerCareer extends Player {
  starts: number;
  totalEvents: number;
  seasonsPlayed: number;
  totalSeasons: number;
  wins: number;
  seasonTitles: number;
  podium: [number, number, number];
  jerseys: number;
}

export interface SeasonRank {
  seasonYear: number;
  rank: number;
  fieldSize: number;
}

export interface HeadToHead extends Player {
  shared: number;
  ahead: number;
  behind: number;
}

function emptyWinsByEvent(): Record<RaceGroupId, number> {
  return { classics: 0, giro: 0, "tour-de-france": 0, vuelta: 0 };
}

function emptyJerseys(): Record<JerseyId, number> {
  return { yel: 0, grn: 0, pol: 0, wht: 0 };
}

/** Only an event that was actually raced carries results. */
export function playedEvents(events: PalmaresEvent[]): PalmaresEvent[] {
  return events.filter((event) => event.status === "played");
}

/**
 * Wins, podium places and starts per player.
 *
 * No participation threshold anywhere: everyone who ever started appears, and
 * the number of starts is displayed next to the counts so the absence of a
 * threshold stays honest without having to be explained.
 */
export function computeWins(events: PalmaresEvent[]): PlayerWins[] {
  const byKey = new Map<string, PlayerWins>();

  for (const event of playedEvents(events)) {
    for (const standing of event.standings) {
      let row = byKey.get(standing.key);
      if (!row) {
        row = {
          key: standing.key,
          displayName: standing.displayName,
          isFormerPlayer: standing.isFormerPlayer,
          podium: [0, 0, 0],
          starts: 0,
          wins: 0,
          winsByEvent: emptyWinsByEvent(),
        };
        byKey.set(standing.key, row);
      }
      row.starts += 1;
      if (standing.rank >= 1 && standing.rank <= 3) {
        row.podium[standing.rank - 1] += 1;
      }
      if (standing.rank === 1) {
        row.wins += 1;
        row.winsByEvent[event.eventType] += 1;
      }
    }
  }

  return [...byKey.values()].sort(
    (a, b) => b.wins - a.wins || b.podium[1] - a.podium[1] || b.podium[2] - a.podium[2]
      || a.displayName.localeCompare(b.displayName),
  );
}

/** Jersey titles per player. Classics award none, so only Grand Tours contribute. */
export function computeJerseys(events: PalmaresEvent[]): PlayerJerseys[] {
  const byKey = new Map<string, PlayerJerseys>();

  for (const event of playedEvents(events)) {
    for (const jersey of JERSEYS) {
      const winner = event.jerseys[jersey];
      if (!winner) continue;
      let row = byKey.get(winner.key);
      if (!row) {
        row = {
          key: winner.key,
          displayName: winner.displayName,
          isFormerPlayer: winner.isFormerPlayer,
          byJersey: emptyJerseys(),
          total: 0,
        };
        byKey.set(winner.key, row);
      }
      row.byJersey[jersey] += 1;
      row.total += 1;
    }
  }

  return [...byKey.values()].sort(
    (a, b) => b.total - a.total || a.displayName.localeCompare(b.displayName),
  );
}

/** The rank a player held in each season standing, with the size of the field. */
export function computeSeasonRanks(
  standings: SeasonStanding[],
  playerKey: string,
): SeasonRank[] {
  const ranks: SeasonRank[] = [];
  for (const season of standings) {
    const index = season.ranking.findIndex((p) => p.key === playerKey);
    if (index === -1) continue;
    ranks.push({
      seasonYear: season.seasonYear,
      rank: index + 1,
      fieldSize: season.ranking.length,
    });
  }
  return ranks.sort((a, b) => a.seasonYear - b.seasonYear);
}

/**
 * Head to head, counted ONLY on the events both players entered.
 *
 * This is the one statistic where playing more gives no advantage: an event the
 * opponent missed simply does not count, for either of them.
 */
export function computeHeadToHead(
  events: PalmaresEvent[],
  playerKey: string,
): HeadToHead[] {
  const byKey = new Map<string, HeadToHead>();

  for (const event of playedEvents(events)) {
    const mine = event.standings.find((s) => s.key === playerKey);
    if (!mine) continue;
    for (const other of event.standings) {
      if (other.key === playerKey) continue;
      let row = byKey.get(other.key);
      if (!row) {
        row = {
          key: other.key,
          displayName: other.displayName,
          isFormerPlayer: other.isFormerPlayer,
          shared: 0,
          ahead: 0,
          behind: 0,
        };
        byKey.set(other.key, row);
      }
      row.shared += 1;
      if (mine.rank < other.rank) row.ahead += 1;
      else if (mine.rank > other.rank) row.behind += 1;
    }
  }

  // Most favourable first. A tie on the share falls back on the number of shared
  // events, so a 2-0 never outranks a 16-8.
  return [...byKey.values()].sort((a, b) => {
    const shareA = a.shared === 0 ? 0 : a.ahead / a.shared;
    const shareB = b.shared === 0 ? 0 : b.ahead / b.shared;
    return shareB - shareA || b.shared - a.shared || a.displayName.localeCompare(b.displayName);
  });
}

export function computeCareer(
  events: PalmaresEvent[],
  standings: SeasonStanding[],
  playerKey: string,
): PlayerCareer | null {
  const wins = computeWins(events).find((w) => w.key === playerKey);
  if (!wins) return null;

  const jerseys = computeJerseys(events).find((j) => j.key === playerKey);
  const played = playedEvents(events);
  const seasonsWithPlayer = new Set(
    played
      .filter((event) => event.standings.some((s) => s.key === playerKey))
      .map((event) => event.seasonYear),
  );
  const seasonTitles = standings.filter(
    (season) => season.ranking[0]?.key === playerKey,
  ).length;

  return {
    key: wins.key,
    displayName: wins.displayName,
    isFormerPlayer: wins.isFormerPlayer,
    starts: wins.starts,
    totalEvents: played.length,
    seasonsPlayed: seasonsWithPlayer.size,
    totalSeasons: new Set(played.map((e) => e.seasonYear)).size,
    wins: wins.wins,
    seasonTitles,
    podium: wins.podium,
    jerseys: jerseys?.total ?? 0,
  };
}

/** Event types that carry at least one played event, in canonical order. */
export function playedEventTypes(events: PalmaresEvent[]): RaceGroupId[] {
  const seen = new Set(playedEvents(events).map((e) => e.eventType));
  return RACE_GROUP_IDS.filter((id) => seen.has(id));
}
