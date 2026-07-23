import { getParentRaceSlug } from "./race-feed-helpers";

const TOUR_PARENT_RE = /^race\/tour-de-france\/(\d{4})$/;

export function getRankingRaceName({
  raceSlug,
  raceName,
}: {
  raceSlug: string;
  raceName: string;
}): string {
  const parentSlug = getParentRaceSlug(raceSlug);
  const tourMatch = parentSlug?.match(TOUR_PARENT_RE);

  if (tourMatch) return `Tour de France ${tourMatch[1]}`;
  return parentSlug
    ? raceName.replace(/\s*(?:\||—)?\s*Stage\s+\d+.*$/i, "") || raceName
    : raceName;
}
