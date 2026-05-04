export interface GtGoal {
  label: string;
  reward: number;
  role: "gc_leader" | "sprinter" | "climber" | "tt_specialist" | "stage_hunter" | null;
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
    { label: "Podium GC final", reward: 150_000, role: "gc_leader", tieredWith: 1 },
    { label: "Top 5 GC final", reward: 75_000, role: "gc_leader", tieredWith: 0 },
    { label: "Win an ITT", reward: 50_000, role: "tt_specialist" },
    { label: "Wear maglia rosa", reward: 50_000, role: "gc_leader" },
    { label: "Wear maglia bianca", reward: 40_000, role: "gc_leader" },
    { label: "2 riders in top 10 of an ITT", reward: 25_000, role: null },
  ]},

  // T4 — Decathlon AG2R (GC + Sprint, nat: FR)
  { sponsorSlug: "decathlon", goals: [
    { label: "Podium GC final", reward: 150_000, role: "gc_leader", tieredWith: 1 },
    { label: "Top 5 GC final", reward: 75_000, role: "gc_leader", tieredWith: 0 },
    { label: "Win a stage", reward: 50_000, role: "sprinter" },
    { label: "Wear maglia rosa", reward: 50_000, role: "gc_leader" },
    { label: "Wear ciclamino", reward: 40_000, role: "sprinter" },
    { label: "Wear maglia bianca", reward: 40_000, role: "gc_leader" },
  ]},

  // T4 — Soudal Quick-Step (Sprint + Stage Hunter, nat: BE)
  { sponsorSlug: "soudal", goals: [
    { label: "Win points classification", reward: 150_000, role: "sprinter" },
    { label: "Win 2 stages", reward: 75_000, role: "sprinter", tieredWith: 4 },
    { label: "2 different riders win a stage", reward: 75_000, role: null },
    { label: "Win a stage", reward: 60_000, role: "stage_hunter" },
    { label: "Win a stage", reward: 50_000, role: "sprinter", tieredWith: 1 },
    { label: "Wear ciclamino", reward: 50_000, role: "sprinter" },
  ]},

  // T4 — Lidl-Trek (Sprint + Stage Hunter, nat: US/IT) — identical goals to Soudal
  { sponsorSlug: "lidl-trek", goals: [
    { label: "Win points classification", reward: 150_000, role: "sprinter" },
    { label: "Win 2 stages", reward: 75_000, role: "sprinter", tieredWith: 4 },
    { label: "2 different riders win a stage", reward: 75_000, role: null },
    { label: "Win a stage", reward: 60_000, role: "stage_hunter" },
    { label: "Win a stage", reward: 50_000, role: "sprinter", tieredWith: 1 },
    { label: "Wear ciclamino", reward: 50_000, role: "sprinter" },
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
