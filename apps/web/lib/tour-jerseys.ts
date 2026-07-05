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
// Display order for jersey boards/strips (Yellow, Green, Polka — Tour convention).
const JERSEY_DISPLAY_ORDER: TourJerseyType[] = ["gc", "points", "kom"];

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

/**
 * Like mapJerseysToTeams but keyed by jersey type instead of team — for
 * displaying "who currently holds each jersey", where a single team holding
 * several jerseys should show under every jersey it holds rather than
 * collapsing to just one.
 */
export function mapJerseysByType(
  holders: Map<string, TourJerseyType>,
  riderTeam: Map<string, string>,
): Map<TourJerseyType, string> {
  const byType = new Map<TourJerseyType, string>();
  for (const [riderId, jersey] of holders) {
    const teamId = riderTeam.get(riderId);
    if (teamId) byType.set(jersey, teamId);
  }
  return byType;
}

export interface TourJerseyRow {
  jerseyType: TourJerseyType;
  teamId: string;
  teamName: string;
  badgeUrl: string;
  tier: AchievementTier;
  achievementName: string;
}

/**
 * Resolves who currently holds each live Tour jersey across the whole league,
 * with the achievement (badge/name/tier) already looked up — used to render
 * jersey badges wherever the app shows race-result badges (e.g. inline in the
 * matching stage's race feed card, via `raceSlug`).
 */
export async function getLeagueTourJerseyRows(
  supabase: SupabaseClient,
  leagueId: string,
): Promise<{ raceSlug: string; rows: TourJerseyRow[] } | null> {
  const current = await getCurrentTourStage(supabase);
  if (!current) return null;

  const { data: teamsRows } = await supabase
    .from("teams")
    .select("id, name")
    .eq("league_id", leagueId);
  const teams = teamsRows ?? [];
  const teamIds = teams.map((t) => t.id);
  if (teamIds.length === 0) return { raceSlug: current.raceSlug, rows: [] };

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

  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
  const jerseyByType = mapJerseysByType(current.holders, riderTeamMap);

  const rows: TourJerseyRow[] = [];
  for (const jerseyType of JERSEY_DISPLAY_ORDER) {
    const teamId = jerseyByType.get(jerseyType);
    if (!teamId) continue;
    const achievement = getAchievementBySlug(TOUR_JERSEY_SLUG[jerseyType]);
    if (!achievement) continue;
    rows.push({
      jerseyType,
      teamId,
      teamName: teamNameById.get(teamId) ?? "Unknown",
      badgeUrl: achievement.badgeUrl,
      tier: achievement.tier,
      achievementName: achievement.name,
    });
  }
  return { raceSlug: current.raceSlug, rows };
}
