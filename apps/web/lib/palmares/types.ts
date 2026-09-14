import type { RaceGroupId } from "@/lib/race-groups";

/** The four jerseys, in display order. Yellow, green, polka dot, white. */
export const JERSEYS = ["yel", "grn", "pol", "wht"] as const;
export type JerseyId = (typeof JERSEYS)[number];

export const JERSEY_LABEL: Record<JerseyId, string> = {
  yel: "YEL",
  grn: "GRN",
  pol: "POL",
  wht: "WHT",
};

/** Short event codes, used in the season cards and the Wins cross table. */
export const EVENT_CODE: Record<RaceGroupId, string> = {
  classics: "CLS",
  giro: "GIR",
  "tour-de-france": "TDF",
  vuelta: "VTA",
};

export const EVENT_LABEL: Record<RaceGroupId, string> = {
  classics: "Classics",
  giro: "Giro",
  "tour-de-france": "Tour de France",
  vuelta: "Vuelta",
};

/** A player, keyed on the account and not on the team: a team name changed at
 *  every single event of the archive. */
export interface Player {
  /** Stable key across both games: the WattHunter account display name.
   *
   *  It is the only bridge available — a closed archive has no user id — which
   *  is why it is the name and not the id. Renaming an account would split that
   *  player's history in two. */
  key: string;
  /** Always the WattHunter account name, never the La Route du Tour pseudonym. */
  displayName: string;
  /** Played before WattHunter and never opened an account. Shown in italics. */
  isFormerPlayer: boolean;
}

export interface EventStanding extends Player {
  rank: number;
}

/** A player in a season standing, with the score that put them there. */
export interface SeasonRankingEntry extends Player {
  /** Season XP on a WattHunter season, raw La Route du Tour points on an
   *  archived one. Two scales that never mix: the unit is displayed next to it,
   *  and nothing ever adds or compares them across eras. */
  score: number;
}

export type EventStatus = "played" | "ongoing" | "upcoming" | "not-played";

/**
 * One event of one season, in the single shape both eras produce. Everything the
 * four tabs display is derived from a list of these plus the season standings.
 */
export interface PalmaresEvent {
  seasonYear: number;
  eventType: RaceGroupId;
  status: EventStatus;
  /** Sorted by rank. Empty when the event was not played or has not happened. */
  standings: EventStanding[];
  /** Jersey winner per classification. Classics award none. */
  jerseys: Partial<Record<JerseyId, Player>>;
}

/** The ranking of a season, all leagues of that year merged, by player. */
export interface SeasonStanding {
  seasonYear: number;
  /** Which game the season was played on. It decides the unit of `score`
   *  (XP or archive points), never the identity shown: name and badge are the
   *  player's current ones on every season. */
  source: "watthunter" | "archive";
  /** True while the season is still being played. */
  isCurrent: boolean;
  /** Free text shown next to the year when there is something to say. */
  note: string | null;
  /** Sorted, rank 1 first. */
  ranking: SeasonRankingEntry[];
}
