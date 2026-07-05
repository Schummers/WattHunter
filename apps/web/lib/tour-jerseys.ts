import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentGTPhase } from "./gt-phases";
import { getAchievementBySlug, type AchievementTier } from "./achievements";

export type TourJerseyType = "gc" | "points" | "kom";

// Auction phase ids: Giro = 4, Tour = 6, Vuelta = 8 (see lib/phases.ts).
const TOUR_PHASE_ID = 6;

export const TOUR_JERSEY_SLUG: Record<TourJerseyType, string> = {
  gc: "tour-gc-victory",
  points: "tour-points-victory",
  kom: "tour-kom-victory",
};

// When a team holds several jerseys at once, the most prestigious wins the slot.
const JERSEY_PRIORITY: TourJerseyType[] = ["gc", "kom", "points"];

function stageNum(slug: string): number {
  const m = slug.match(/\/stage-(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

interface CurrentTourStage {
  /** race_slug of the latest synced Tour stage, e.g. "race/tour-de-france/2026/stage-1". */
  raceSlug: string;
  /** rider_id -> jersey type, rank 1 holders on that stage. */
  holders: Map<string, TourJerseyType>;
}

/**
 * Resolves the latest synced Tour stage's jersey holders plus that stage's
 * race_slug, so callers can attach jersey info to the matching race feed
 * card. Returns null outside the Tour phase or before any stage is synced.
 */
export async function getCurrentTourStage(
  supabase: SupabaseClient,
): Promise<CurrentTourStage | null> {
  const phase = getCurrentGTPhase();
  if (!phase || phase.id !== TOUR_PHASE_ID) return null;

  const year = new Date().getFullYear();
  const { data } = await supabase
    .from("gt_daily_classifications")
    .select("rider_id, classification_type, rank, race_slug")
    .ilike("race_slug", `race/tour-de-france/${year}/stage-%`)
    .eq("rank", 1)
    .in("classification_type", ["gc", "points", "kom"]);

  const rows = (data ?? []) as Array<{
    rider_id: string;
    classification_type: TourJerseyType;
    race_slug: string;
  }>;
  if (rows.length === 0) return null;

  const maxStage = Math.max(...rows.map((r) => stageNum(r.race_slug)));
  const raceSlug = rows.find((r) => stageNum(r.race_slug) === maxStage)!.race_slug;

  const holders = new Map<string, TourJerseyType>();
  for (const r of rows) {
    if (stageNum(r.race_slug) !== maxStage) continue;
    holders.set(r.rider_id, r.classification_type);
  }
  return { raceSlug, holders };
}

/**
 * During the Tour, returns rider_id -> jersey type for the *current* holders
 * (rank 1 on the latest synced Tour stage). Empty outside the Tour phase or
 * before any stage is synced. This is a live, non-destructive overlay: the
 * team owning the rider who currently wears a jersey shows that jersey badge,
 * without touching their equipped_achievement_slug.
 */
export async function getTourJerseyHolders(
  supabase: SupabaseClient,
): Promise<Map<string, TourJerseyType>> {
  const current = await getCurrentTourStage(supabase);
  return current?.holders ?? new Map();
}

/**
 * Reduce rider->jersey holders to team->jersey using ownership
 * (rider_id -> team_id from active contracts). Highest-priority jersey wins
 * when a team holds more than one.
 */
export function mapJerseysToTeams(
  holders: Map<string, TourJerseyType>,
  riderTeam: Map<string, string>,
): Map<string, TourJerseyType> {
  const best = new Map<string, TourJerseyType>();
  for (const [riderId, jersey] of holders) {
    const teamId = riderTeam.get(riderId);
    if (!teamId) continue;
    const current = best.get(teamId);
    if (!current || JERSEY_PRIORITY.indexOf(jersey) < JERSEY_PRIORITY.indexOf(current)) {
      best.set(teamId, jersey);
    }
  }
  return best;
}

export interface TourJerseyBadge {
  jerseyType: TourJerseyType;
  badgeUrl: string;
  bannerUrl: string;
  tier: AchievementTier;
  achievementName: string;
}

/**
 * team_id -> live Tour jersey it currently holds (achievement already looked
 * up, highest-priority jersey when a team holds several), plus the race_slug
 * of the stage those standings belong to. Used to overlay the jersey on top
 * of a team's normal equipped badge/banner — exactly like the ranking page,
 * but here scoped to a race-result card via `raceSlug`. Null outside the Tour.
 */
export async function getTourJerseyOverrides(
  supabase: SupabaseClient,
  leagueId: string,
): Promise<{ raceSlug: string; byTeam: Map<string, TourJerseyBadge> } | null> {
  const current = await getCurrentTourStage(supabase);
  if (!current) return null;

  const { data: teamsRows } = await supabase
    .from("teams")
    .select("id")
    .eq("league_id", leagueId);
  const teamIds = (teamsRows ?? []).map((t) => t.id as string);
  if (teamIds.length === 0) return { raceSlug: current.raceSlug, byTeam: new Map() };

  const holderRiderIds = [...current.holders.keys()];
  const { data: contractsRows } = await supabase
    .from("contracts")
    .select("team_id, rider_id")
    .in("team_id", teamIds)
    .eq("status", "active")
    .in("rider_id", holderRiderIds);

  const riderTeamMap = new Map<string, string>();
  for (const c of (contractsRows ?? []) as Array<{ team_id: string; rider_id: string }>) {
    riderTeamMap.set(c.rider_id, c.team_id);
  }

  const teamJersey = mapJerseysToTeams(current.holders, riderTeamMap);
  const byTeam = new Map<string, TourJerseyBadge>();
  for (const [teamId, jerseyType] of teamJersey) {
    const achievement = getAchievementBySlug(TOUR_JERSEY_SLUG[jerseyType]);
    if (!achievement) continue;
    byTeam.set(teamId, {
      jerseyType,
      badgeUrl: achievement.badgeUrl,
      bannerUrl: achievement.bannerUrl,
      tier: achievement.tier,
      achievementName: achievement.name,
    });
  }
  return { raceSlug: current.raceSlug, byTeam };
}
