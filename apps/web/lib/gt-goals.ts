export type GtGoalCategory = "gc" | "sprint" | "tt" | "stage_hunter";

export interface GtGoal {
  label: string;
  reward: number; // A (1-week base) value; ×2 applied at eval for GT/Monument
  role: "gc_leader" | "sprinter" | "climber" | "tt_specialist" | "stage_hunter" | null;
  category: GtGoalCategory;
  tierGroup?: string; // goals sharing a tierGroup → only the highest reward pays (per rider)
}

export interface GtGoalSet {
  sponsorSlug: string;
  goals: GtGoal[];
}

const GC_GOALS: GtGoal[] = [
  { label: "Podium GC", reward: 30_000, role: "gc_leader", category: "gc", tierGroup: "gc_placement" },
  { label: "Top 5 GC", reward: 20_000, role: "gc_leader", category: "gc", tierGroup: "gc_placement" },
  { label: "Wear the Race Leader jersey", reward: 15_000, role: "gc_leader", category: "gc" },
  { label: "Wear the young rider jersey", reward: 10_000, role: "gc_leader", category: "gc" },
];

const SPRINT_GOALS: GtGoal[] = [
  { label: "Win the points classification", reward: 30_000, role: "sprinter", category: "sprint" },
  { label: "Win 2 stages", reward: 20_000, role: "sprinter", category: "sprint", tierGroup: "sprint_stages" },
  { label: "Win a stage", reward: 10_000, role: "sprinter", category: "sprint", tierGroup: "sprint_stages" },
  { label: "Wear the points jersey", reward: 10_000, role: "sprinter", category: "sprint" },
];

const CLM_GOALS: GtGoal[] = [
  { label: "Win an ITT", reward: 15_000, role: "tt_specialist", category: "tt" },
  { label: "2 riders in top 10 of an ITT", reward: 10_000, role: null, category: "tt" },
];

const STAGE_HUNTER_GOALS: GtGoal[] = [
  { label: "Win the KOM classification", reward: 20_000, role: "climber", category: "stage_hunter" },
  { label: "Win 2 stages", reward: 20_000, role: "stage_hunter", category: "stage_hunter", tierGroup: "sh_stages" },
  { label: "Win a stage", reward: 10_000, role: "stage_hunter", category: "stage_hunter", tierGroup: "sh_stages" },
  { label: "Wear the KOM jersey", reward: 10_000, role: "climber", category: "stage_hunter" },
];

export const GT_GOALS: GtGoalSet[] = [
  { sponsorSlug: "ineos", goals: [...GC_GOALS, ...CLM_GOALS] },
  { sponsorSlug: "decathlon", goals: [...GC_GOALS, ...SPRINT_GOALS] },
  { sponsorSlug: "soudal", goals: [...SPRINT_GOALS, ...STAGE_HUNTER_GOALS] },
  { sponsorSlug: "lidl-trek", goals: [...SPRINT_GOALS, ...STAGE_HUNTER_GOALS] },
  { sponsorSlug: "visma", goals: [...GC_GOALS, ...SPRINT_GOALS] },
  { sponsorSlug: "redbull-bora", goals: [...GC_GOALS, ...STAGE_HUNTER_GOALS] },
];

export function getGoalsForSponsor(slug: string): GtGoal[] {
  return GT_GOALS.find((g) => g.sponsorSlug === slug)?.goals ?? [];
}
