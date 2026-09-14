import calendarData from "../../../services/pcs-sync/wt_calendar_2026.json";
import { getParentRaceSlug } from "./race-feed-helpers";

export type WtRaceType = "one-day" | "stage-race";

/**
 * Source of truth for "one-day race or stage race": the `type` field of the
 * World Tour calendar.
 *
 * NEVER derive it from `race_results.stage IS NULL` — the general classification
 * of a one-week race arrives without a stage number and would be counted as a
 * one-day race. And never from a hand-copied list of slugs, which drifts from
 * the calendar the pipeline actually scrapes.
 */
const TYPE_BY_RACE_KEY = new Map<string, WtRaceType>(
  (calendarData as { slug: string; type: WtRaceType }[]).map((race) => [
    raceKey(race.slug),
    race.type,
  ]),
);

/**
 * `race/paris-roubaix/2026` -> `paris-roubaix`. Year-agnostic on purpose: the
 * calendar file is written per season, the race groups must hold for every
 * season of the historical archive.
 */
function raceKey(raceSlug: string): string {
  return raceSlug.split("/")[1] ?? raceSlug;
}

/** Accepts a stage / final-classification slug as well as a parent slug. */
export function getWtRaceType(raceSlug: string): WtRaceType | null {
  const parentSlug = getParentRaceSlug(raceSlug) ?? raceSlug;
  return TYPE_BY_RACE_KEY.get(raceKey(parentSlug)) ?? null;
}

export function isOneDayRace(raceSlug: string): boolean {
  return getWtRaceType(raceSlug) === "one-day";
}

export function isStageRace(raceSlug: string): boolean {
  return getWtRaceType(raceSlug) === "stage-race";
}

export const RACE_GROUP_IDS = ["classics", "giro", "tour-de-france", "vuelta"] as const;
export type RaceGroupId = (typeof RACE_GROUP_IDS)[number];

export const RACE_GROUP_LABEL: Record<RaceGroupId, string> = {
  classics: "Classics",
  giro: "Giro",
  "tour-de-france": "Tour de France",
  vuelta: "Vuelta",
};

const GROUP_BY_GRAND_TOUR_KEY: Record<string, RaceGroupId> = {
  "giro-d-italia": "giro",
  "tour-de-france": "tour-de-france",
  "vuelta-a-espana": "vuelta",
};

/**
 * The four groups an event can belong to. One-week stage races (Paris-Nice,
 * Tirreno-Adriatico, the Dauphiné…) belong to none and return null: they are
 * out of the palmarès perimeter.
 *
 * Classics is every one-day race of the season, which is also why the two
 * Classics auction phases end up merged into a single entry: the group is
 * derived from the race type, not from the phase window it falls in.
 */
export function getRaceGroupId(raceSlug: string): RaceGroupId | null {
  const parentSlug = getParentRaceSlug(raceSlug) ?? raceSlug;
  const grandTourGroup = GROUP_BY_GRAND_TOUR_KEY[raceKey(parentSlug)];
  if (grandTourGroup) return grandTourGroup;
  return isOneDayRace(parentSlug) ? "classics" : null;
}

export interface RaceGroup {
  slug: RaceGroupId;
  name: string;
  childSlugs: string[];
}

/**
 * Turns the raw race slugs found in `rider_xp_daily` into the four ranking
 * groups. A group with no scored race at all is left out.
 */
export function buildRaceGroups(raceSlugs: string[]): RaceGroup[] {
  const childrenByGroup = new Map<RaceGroupId, string[]>();

  for (const slug of raceSlugs) {
    const groupId = getRaceGroupId(slug);
    if (!groupId) continue;
    const children = childrenByGroup.get(groupId);
    if (children) {
      if (!children.includes(slug)) children.push(slug);
    } else {
      childrenByGroup.set(groupId, [slug]);
    }
  }

  return RACE_GROUP_IDS.filter((id) => childrenByGroup.has(id)).map((id) => ({
    slug: id,
    name: RACE_GROUP_LABEL[id],
    childSlugs: childrenByGroup.get(id) ?? [],
  }));
}

/**
 * Resolves the `?race=` query parameter of the ranking page. Accepts a group id
 * as well as a race slug, so the links the race feed already emits
 * (`?race=race/giro-d-italia/2026`) keep landing on the right group.
 */
export function resolveRaceGroupParam(value: string | null | undefined): RaceGroupId | null {
  if (!value) return null;
  if ((RACE_GROUP_IDS as readonly string[]).includes(value)) return value as RaceGroupId;
  return getRaceGroupId(value);
}

/**
 * PostgREST `ilike` patterns matching every one-day race of the World Tour
 * calendar, across all years (`race/<name>/%`).
 *
 * Exists so a server query can filter on one-day races without a hand-written
 * list of slugs. The hand-written one drifted: it carried Paris-Nice and
 * Tirreno-Adriatico, two stage races, inside the "Classic Man" achievement.
 */
export function oneDayRaceSlugPatterns(): string[] {
  return (calendarData as { slug: string; type: WtRaceType }[])
    .filter((race) => race.type === "one-day")
    .map((race) => `race/${raceKey(race.slug)}/%`);
}
