export type GtGoalCategory = "gc" | "sprint" | "tt" | "stage_hunter";

export interface GtGoal {
  label: string;
  reward: number;
  role: "gc_leader" | "sprinter" | "climber" | "tt_specialist" | "stage_hunter" | null;
  category: GtGoalCategory;
  tieredWith?: number;
}

export interface GtGoalSet {
  sponsorSlug: string;
  goals: GtGoal[];
}

/**
 * GT-specific goals — T4 sponsors only. Display + future evaluation.
 * V1a: display only. V1b adds evaluation + payout.
 * Spec: docs/superpowers/specs/2026-05-03-sponsor-gt-goals-design.md
 */
export const GT_GOALS: GtGoalSet[] = [
  // T1 — no specific goals
  { sponsorSlug: "lotto", goals: [] },
  // T2 — no specific goals
  { sponsorSlug: "astana", goals: [] },
  // T3 — no specific goals (deferred)
  { sponsorSlug: "groupama", goals: [] },
  { sponsorSlug: "movistar", goals: [] },
  { sponsorSlug: "alpecin", goals: [] },
  { sponsorSlug: "unox", goals: [] },

  // T4 — Ineos Grenadiers (GC + TT, nat: GB)
  { sponsorSlug: "ineos", goals: [
    { label: "Podium GC final", reward: 150_000, role: "gc_leader", category: "gc", tieredWith: 1 },
    { label: "Top 5 GC final", reward: 75_000, role: "gc_leader", category: "gc", tieredWith: 0 },
    { label: "Wear maglia rosa", reward: 50_000, role: "gc_leader", category: "gc" },
    { label: "Wear maglia bianca", reward: 40_000, role: "gc_leader", category: "gc" },
    { label: "Win an ITT", reward: 50_000, role: "tt_specialist", category: "tt" },
    { label: "2 riders in top 10 of an ITT", reward: 25_000, role: null, category: "tt" },
  ]},

  // T4 — Decathlon AG2R (GC + Sprint, nat: FR)
  { sponsorSlug: "decathlon", goals: [
    { label: "Podium GC final", reward: 150_000, role: "gc_leader", category: "gc", tieredWith: 1 },
    { label: "Top 5 GC final", reward: 75_000, role: "gc_leader", category: "gc", tieredWith: 0 },
    { label: "Wear maglia rosa", reward: 50_000, role: "gc_leader", category: "gc" },
    { label: "Wear maglia bianca", reward: 40_000, role: "gc_leader", category: "gc" },
    { label: "Win a stage", reward: 50_000, role: "sprinter", category: "sprint" },
    { label: "Wear ciclamino", reward: 40_000, role: "sprinter", category: "sprint" },
  ]},

  // T4 — Soudal Quick-Step (Sprint + Stage Hunter, nat: BE)
  { sponsorSlug: "soudal", goals: [
    { label: "Win points classification", reward: 150_000, role: "sprinter", category: "sprint" },
    { label: "Win 2 stages", reward: 75_000, role: "sprinter", category: "sprint", tieredWith: 2 },
    { label: "Win a stage", reward: 50_000, role: "sprinter", category: "sprint", tieredWith: 1 },
    { label: "Wear ciclamino", reward: 50_000, role: "sprinter", category: "sprint" },
    { label: "2 different riders win a stage", reward: 75_000, role: null, category: "stage_hunter" },
    { label: "Win a stage", reward: 60_000, role: "stage_hunter", category: "stage_hunter" },
  ]},

  // T4 — Lidl-Trek (Sprint + Stage Hunter, nat: US/IT) — identical goals to Soudal
  { sponsorSlug: "lidl-trek", goals: [
    { label: "Win points classification", reward: 150_000, role: "sprinter", category: "sprint" },
    { label: "Win 2 stages", reward: 75_000, role: "sprinter", category: "sprint", tieredWith: 2 },
    { label: "Win a stage", reward: 50_000, role: "sprinter", category: "sprint", tieredWith: 1 },
    { label: "Wear ciclamino", reward: 50_000, role: "sprinter", category: "sprint" },
    { label: "2 different riders win a stage", reward: 75_000, role: null, category: "stage_hunter" },
    { label: "Win a stage", reward: 60_000, role: "stage_hunter", category: "stage_hunter" },
  ]},

  // T5 — no specific goals (keep base bonus only)
  { sponsorSlug: "visma", goals: [] },
  { sponsorSlug: "redbull-bora", goals: [] },
  // T6 — no specific goals
  { sponsorSlug: "uae", goals: [] },
];

export function getGoalsForSponsor(slug: string): GtGoal[] {
  return GT_GOALS.find((g) => g.sponsorSlug === slug)?.goals ?? [];
}
