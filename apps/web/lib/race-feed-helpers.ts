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

// Final classifications of a stage race. `gc` lives in race_results (PCS gives it
// real points); the three jersey finals live in gt_final_classifications.
export const SECONDARY_FINAL_TYPES = ["points", "kom", "youth"] as const;
export type SecondaryFinalType = (typeof SECONDARY_FINAL_TYPES)[number];
export type FinalClassificationType = "gc" | SecondaryFinalType;

const FINAL_SUFFIX_RE = /\/(gc|points|kom|youth)$/;

export function getFinalClassificationType(raceSlug: string): FinalClassificationType | null {
  const m = raceSlug.match(FINAL_SUFFIX_RE);
  return m ? (m[1] as FinalClassificationType) : null;
}

export function isSecondaryFinalSlug(raceSlug: string): boolean {
  const t = getFinalClassificationType(raceSlug);
  return t !== null && t !== "gc";
}

const FINAL_LABELS: Record<FinalClassificationType, string> = {
  gc: "Final GC",
  points: "Points",
  kom: "KOM",
  youth: "Youth",
};

export function getFinalClassificationLabel(type: FinalClassificationType): string {
  return FINAL_LABELS[type];
}

// Order of the four final cards inside a date group — they all share the last
// stage's date, so without this they would land in whatever order the feed
// happened to build them.
const FINAL_SORT_RANK: Record<FinalClassificationType, number> = {
  gc: 1,
  points: 2,
  kom: 3,
  youth: 4,
};

export function finalCardSortRank(raceSlug: string): number {
  const type = getFinalClassificationType(raceSlug);
  return type ? FINAL_SORT_RANK[type] : 0;
}

// "La Vuelta Ciclista a España — Stage 21 - GC" → "La Vuelta Ciclista a España".
// Python writes the GC row's race_name from the last stage it was imported with
// (sync_race.py), so the raw name drags a stage number we never want to show.
const RACE_NAME_SEPARATOR_RE = /\s[\u2014\u2013-]\s/;

export function baseRaceName(raceName: string): string {
  return raceName.split(RACE_NAME_SEPARATOR_RE)[0]!.trim();
}

export function formatRaceTitle(input: {
  raceType: RaceType;
  raceName: string;
  raceSlug: string;
  parentRaceLabel: string | null;
}): string {
  if (input.raceType === "stage") {
    const stage = getStageNumber(input.raceSlug);
    const parent = input.parentRaceLabel ?? baseRaceName(input.raceName);
    return `${parent} · Stage ${stage ?? "?"}`;
  }
  const finalType = getFinalClassificationType(input.raceSlug);
  if (finalType) {
    const parent = input.parentRaceLabel ?? baseRaceName(input.raceName);
    return `${parent} · ${getFinalClassificationLabel(finalType)}`;
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

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatRaceDateLabel(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map((s) => parseInt(s, 10));
  const monthLabel = MONTHS_SHORT[(month ?? 1) - 1];
  return `${day} ${monthLabel}`;
}

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatRound1DateLabel(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map((s) => parseInt(s, 10));
  return `${day} ${MONTHS_LONG[(month ?? 1) - 1]}`;
}
