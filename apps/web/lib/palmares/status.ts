import type { EventStatus } from "./types";

export interface EventStatusInput {
  /** The group produced XP for at least one player this season. */
  hasResults: boolean;
  /** Calendar window of the group, shifted to the season year. */
  window: { start: string; end: string } | null;
  /** Key of the last calendar race of the group already over, from `getLastFinishedRaceKey`. */
  lastFinishedRaceKey: string | null;
  /** Keys of the group's races that actually produced XP. */
  playedRaceKeys: ReadonlySet<string>;
  today: string;
}

/**
 * Status of one event of a season.
 *
 * A group is over either because its calendar window has passed — the only rule
 * a Grand Tour ever needs, it is a single event with a real end date — or
 * because the league stopped playing it: the last race of the group that has
 * already been run produced no XP. The classics need that second clause, since
 * their window spans the whole season (Omloop in February to Il Lombardia in
 * October) while a league plays a slice of it and stops.
 *
 * Known limitation, deliberate: a league that skips one classic in the MIDDLE of
 * the season shows the group as played until the next one is raced, then back to
 * ongoing. Closing on the tail is what matters; a rule that never flips would
 * need a per-season list of the races the league intends to play, which does not
 * exist. See `status.test.ts`, the case is covered by a test on purpose.
 */
export function resolveEventStatus({
  hasResults,
  window,
  lastFinishedRaceKey,
  playedRaceKeys,
  today,
}: EventStatusInput): EventStatus {
  if (!hasResults) {
    if (window && today < window.start) return "upcoming";
    return "not-played";
  }

  if (!window || today > window.end) return "played";
  if (lastFinishedRaceKey !== null && !playedRaceKeys.has(lastFinishedRaceKey)) return "played";
  return "ongoing";
}
