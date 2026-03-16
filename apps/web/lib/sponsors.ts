import { countryCodeToFlag } from "@/lib/format";

/** Nationality aliases — sponsors accepting multiple nationalities */
export const NATIONALITY_ALIASES: Record<string, string[]> = {
  DK: ["DK", "NO"],
  BE: ["BE", "NL"],
};

/** Resolve nationality to all accepted codes */
export function expandNationality(code: string): string[] {
  return NATIONALITY_ALIASES[code] ?? [code];
}

/** Human-readable result condition labels */
export const RESULT_LABELS: Record<string, string> = {
  top10_classic: "Top 10 classic",
  top10_stage_race: "Top 10 stage race",
  top10_gt_monument: "Top 10 GT/monument",
  top5_gt_monument: "Top 5 GT/monument",
};

/** Human-readable specialty labels */
export const SPECIALTY_LABELS: Record<string, string> = {
  GC: "GC",
  OneDay: "One-day",
  Sprint: "Sprint",
  TT: "TT",
};

/** Format specialty array as "One-day or Sprint" */
export function formatSpecialties(specialties: string[]): string {
  return specialties.map((s) => SPECIALTY_LABELS[s] ?? s).join(" or ");
}

/** Format nationality condition: "🇫🇷 2×" or "🇧🇪/🇳🇱 2×" */
export function formatNationalityCondition(code: string, count: number): string {
  const aliases = NATIONALITY_ALIASES[code];
  if (aliases && aliases.length > 1) {
    return `${aliases.map(countryCodeToFlag).join("/")} ${count}×`;
  }
  return `${countryCodeToFlag(code)} ${count}×`;
}

export interface SponsorRow {
  id: string;
  name: string;
  abbreviation: string;
  tier: number;
  slot: "secondary" | "principal";
  monthly_budget: number;
  first_phase_budget: number | null;
  unlock_level: number;
  nationality: string | null;
  nationality_count: number;
  specialty: string[];
  result_condition: string | null;
  sort_order: number;
}

/** Per-sponsor eligibility result */
export interface SponsorEligibility {
  sponsorId: string;
  eligible: boolean;
  conditions: {
    nationality: boolean | null;
    specialty: boolean | null;
    result: boolean | null;
  };
}

/** Result condition → race_results query mapping */
export const RESULT_CONDITION_FILTERS: Record<string, { race_class: string[]; max_position: number }> = {
  top10_classic: { race_class: ["monument", "classic"], max_position: 10 },
  top10_stage_race: { race_class: ["stage_race", "grand_tour"], max_position: 10 },
  top10_gt_monument: { race_class: ["grand_tour", "monument"], max_position: 10 },
  top5_gt_monument: { race_class: ["grand_tour", "monument"], max_position: 5 },
};

/** Race slug → race_class mapping for pipeline sync */
export const RACE_CLASS_MAP: Record<string, string> = {
  "milano-sanremo": "monument",
  "ronde-van-vlaanderen": "monument",
  "paris-roubaix": "monument",
  "liege-bastogne-liege": "monument",
  "il-lombardia": "monument",
  "giro-d-italia": "grand_tour",
  "tour-de-france": "grand_tour",
  "vuelta-a-espana": "grand_tour",
  "strade-bianche": "classic",
  "e3-harelbeke": "classic",
  "gent-wevelgem": "classic",
  "amstel-gold-race": "classic",
  "la-fleche-wallonne": "classic",
  "san-sebastian": "classic",
  "bretagne-classic": "classic",
  "cyclassics-hamburg": "classic",
  "gp-quebec": "classic",
  "gp-montreal": "classic",
  "omloop-het-nieuwsblad": "classic",
  "dwars-door-vlaanderen": "classic",
  "paris-nice": "stage_race",
  "tirreno-adriatico": "stage_race",
  "volta-a-catalunya": "stage_race",
  "itzulia": "stage_race",
  "tour-de-romandie": "stage_race",
  "dauphine": "stage_race",
  "tour-de-suisse": "stage_race",
  "tour-de-pologne": "stage_race",
  "renewi-tour": "stage_race",
};
