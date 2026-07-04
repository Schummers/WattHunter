import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentGTPhase } from "./gt-phases";

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
  const phase = getCurrentGTPhase();
  if (!phase || phase.id !== TOUR_PHASE_ID) return new Map();

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
  if (rows.length === 0) return new Map();

  const maxStage = Math.max(...rows.map((r) => stageNum(r.race_slug)));

  const holders = new Map<string, TourJerseyType>();
  for (const r of rows) {
    if (stageNum(r.race_slug) !== maxStage) continue;
    holders.set(r.rider_id, r.classification_type);
  }
  return holders;
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
