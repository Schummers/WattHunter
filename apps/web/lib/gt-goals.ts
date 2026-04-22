export interface GtGoal {
  label: string;
  reward: number;
}

export interface GtGoalSet {
  sponsorSlug: string;
  goals: GtGoal[];
}

/**
 * Hand-curated in V1a — display only. V1b adds evaluation + payout.
 * One entry per sponsor slug (see supabase/migrations/20260402300000_sponsors_rework.sql).
 *
 * BLOCKING: the user must finalize this list before merging V1a.
 */
export const GT_GOALS: GtGoalSet[] = [
  { sponsorSlug: "lotto", goals: [
    { label: "Win 1 stage", reward: 20_000 },
    { label: "Top 20 GC final", reward: 15_000 },
    { label: "Top 5 points classification", reward: 20_000 },
    { label: "5 top-10 stage finishes", reward: 25_000 },
  ]},
  { sponsorSlug: "astana", goals: [
    { label: "Win 2 stages", reward: 40_000 },
    { label: "Top 15 GC final", reward: 30_000 },
    { label: "Wear maglia rosa ≥ 2 days", reward: 35_000 },
    { label: "Top 3 KOM classification", reward: 30_000 },
  ]},
  { sponsorSlug: "groupama", goals: [
    { label: "Top 10 GC", reward: 30_000 },
    { label: "Win 1 stage", reward: 25_000 },
    { label: "Maglia rosa ≥ 3 days", reward: 40_000 },
    { label: "2 FR riders top 20 GC", reward: 50_000 },
  ]},
  { sponsorSlug: "movistar", goals: [
    { label: "Top 10 GC", reward: 30_000 },
    { label: "Win 1 stage", reward: 25_000 },
    { label: "ES rider top 15 GC", reward: 40_000 },
    { label: "Top 5 KOM classification", reward: 35_000 },
  ]},
  { sponsorSlug: "alpecin", goals: [
    { label: "Win 2 stages", reward: 50_000 },
    { label: "Wear maglia ciclamino ≥ 1 day", reward: 30_000 },
    { label: "Top 3 points classification", reward: 45_000 },
    { label: "BE/NL rider stage win", reward: 35_000 },
  ]},
  { sponsorSlug: "unox", goals: [
    { label: "Win 1 stage", reward: 35_000 },
    { label: "Top 3 points classification", reward: 45_000 },
    { label: "DK/NO rider top 10 stage", reward: 30_000 },
    { label: "3 top-10 stage finishes", reward: 25_000 },
  ]},
  { sponsorSlug: "ineos", goals: [
    { label: "Top 5 GC", reward: 60_000 },
    { label: "Win 2 stages", reward: 50_000 },
    { label: "Wear maglia rosa ≥ 5 days", reward: 80_000 },
    { label: "GB rider top 10 GC", reward: 55_000 },
  ]},
  { sponsorSlug: "decathlon", goals: [
    { label: "Top 5 GC", reward: 60_000 },
    { label: "Win 1 stage", reward: 40_000 },
    { label: "Top 3 KOM classification", reward: 50_000 },
    { label: "FR rider top 15 GC", reward: 55_000 },
  ]},
  { sponsorSlug: "soudal", goals: [
    { label: "Win 3 stages", reward: 70_000 },
    { label: "Top 3 points classification", reward: 50_000 },
    { label: "BE rider top 10 stage × 3", reward: 45_000 },
    { label: "Top 15 GC", reward: 40_000 },
  ]},
  { sponsorSlug: "lidl-trek", goals: [
    { label: "Win 2 stages", reward: 55_000 },
    { label: "Top 5 points classification", reward: 40_000 },
    { label: "US/IT rider stage win", reward: 45_000 },
    { label: "Top 10 GC", reward: 55_000 },
  ]},
  { sponsorSlug: "visma", goals: [
    { label: "Top 3 GC", reward: 120_000 },
    { label: "Win 3 stages", reward: 90_000 },
    { label: "Wear maglia rosa ≥ 7 days", reward: 150_000 },
    { label: "Double classification podium", reward: 130_000 },
  ]},
  { sponsorSlug: "redbull-bora", goals: [
    { label: "Top 3 GC", reward: 120_000 },
    { label: "Win 2 stages", reward: 70_000 },
    { label: "Top 3 KOM classification", reward: 80_000 },
    { label: "Wear any jersey ≥ 5 days", reward: 100_000 },
  ]},
  { sponsorSlug: "uae", goals: [
    { label: "Win overall GC", reward: 300_000 },
    { label: "Win 4 stages", reward: 150_000 },
    { label: "Double classification win", reward: 200_000 },
    { label: "Wear maglia rosa ≥ 10 days", reward: 180_000 },
  ]},
];

export function getGoalsForSponsor(slug: string): GtGoal[] {
  return GT_GOALS.find((g) => g.sponsorSlug === slug)?.goals ?? [];
}
