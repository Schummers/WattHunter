import type { RaceType } from "./race-feed-types";

const STAGE_SUFFIX_RE = /\/stage-(\d+)$/;

export function detectRaceType(raceSlug: string): RaceType {
  return STAGE_SUFFIX_RE.test(raceSlug) ? "stage" : "classic";
}

// Children of a parent race that should roll up under that parent for ranking,
// race-feed grouping, and "Giro/Tour/Vuelta XP totals":
//   - stage-N           — numbered stages of a multi-stage race
//   - gc                — final General Classification (Spec A A2)
//   - points / kom / youth — final secondary jerseys (Spec A A2)
const PARENT_CHILD_SUFFIX_RE = /^(.+)\/(stage-\d+|gc|points|kom|youth)$/;

export function getParentRaceSlug(raceSlug: string): string | null {
  const m = raceSlug.match(PARENT_CHILD_SUFFIX_RE);
  return m ? m[1] : null;
}

const PARENT_LABEL_BY_PREFIX: Record<string, string> = {
  "race/giro-d-italia": "Giro",
  "race/tour-de-france": "Tour",
  "race/vuelta-a-espana": "Vuelta",
};

export function getParentRaceLabel(parentRaceSlug: string): string | null {
  for (const [prefix, label] of Object.entries(PARENT_LABEL_BY_PREFIX)) {
    if (parentRaceSlug.startsWith(prefix)) return label;
  }
  return null;
}

export function getStageNumber(raceSlug: string): number | null {
  const m = raceSlug.match(STAGE_SUFFIX_RE);
  return m ? parseInt(m[1], 10) : null;
}

export function formatRaceTitle(input: {
  raceType: RaceType;
  raceName: string;
  raceSlug: string;
  parentRaceLabel: string | null;
}): string {
  if (input.raceType === "stage") {
    const stage = getStageNumber(input.raceSlug);
    const parent = input.parentRaceLabel ?? input.raceName.split(" - ")[0];
    return `${parent} · Stage ${stage ?? "?"}`;
  }
  return input.raceName;
}

export function shortenRiderName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const initial = parts[0][0]!.toUpperCase();
  const lastName = parts.slice(1).join(" ");
  return `${initial}. ${lastName}`;
}

export function teamInitials(teamName: string): string {
  const parts = teamName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatBonusEur(amount: number): string {
  if (amount <= 0) return "—";
  const withSpaces = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `+${withSpaces}€`;
}

export function formatXp(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

const FRENCH_MONTHS_SHORT = [
  "janv.", "fév.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

export function formatRaceDateLabel(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map((s) => parseInt(s, 10));
  const monthLabel = FRENCH_MONTHS_SHORT[(month ?? 1) - 1];
  return `${day} ${monthLabel}`;
}

const FRENCH_LONG_MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function formatRound1DateLabel(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map((s) => parseInt(s, 10));
  return `${day} ${FRENCH_LONG_MONTHS[(month ?? 1) - 1]}`;
}
