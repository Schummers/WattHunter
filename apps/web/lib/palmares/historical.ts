import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllSupabasePages } from "@/lib/supabase-pagination";
import type { RaceGroupId } from "@/lib/race-groups";
import { HIDDEN_PLAYERS } from "./hidden-players";
import { JERSEYS, type JerseyId, type PalmaresEvent, type Player, type SeasonStanding } from "./types";

interface HistoricalTourRow {
  tour_id: number;
  season_year: number;
  event_type: RaceGroupId;
}

interface HistoricalResultRow {
  tour_id: number;
  player_key: string;
  display_name: string;
  is_former_player: boolean;
  rank: number;
  total: number;
  gc_points: number;
  sprinter: number;
  climber: number;
  young_rider: number;
}

/** Which raw points column decides each jersey. */
const JERSEY_COLUMN: Record<JerseyId, keyof HistoricalResultRow> = {
  yel: "gc_points",
  grn: "sprinter",
  pol: "climber",
  wht: "young_rider",
};

/**
 * Players never counted twice across the two eras: the bridge between the
 * archive and WattHunter is the account display name, which is what the import
 * stored and what the app displays. Renaming an account would split a player's
 * history in two — the trade-off of not having a user id in a closed archive.
 */
function toPlayer(row: HistoricalResultRow): Player {
  return {
    key: row.display_name,
    displayName: row.display_name,
    isFormerPlayer: row.is_former_player,
  };
}

export interface HistoricalPalmares {
  events: PalmaresEvent[];
  standings: SeasonStanding[];
}

export async function loadHistoricalPalmares(
  supabase: SupabaseClient,
): Promise<HistoricalPalmares> {
  // Paginated even though the archive is 24 tours and 187 rows and will never
  // grow: PostgREST truncates at 1000 rows without saying so, and an unpaginated
  // read is how Pogačar vanished from the ranking (see the 2026-07 pagination
  // fix). A closed table is not a reason to write the query that fails silently.
  const [tourRows, resultRows] = await Promise.all([
    fetchAllSupabasePages<HistoricalTourRow>((from, to) =>
      supabase
        .from("historical_tours")
        .select("tour_id, season_year, event_type")
        .order("tour_id")
        .range(from, to),
    ),
    fetchAllSupabasePages<HistoricalResultRow>((from, to) =>
      supabase
        .from("historical_results")
        .select(
          "tour_id, player_key, display_name, is_former_player, rank, total, gc_points, sprinter, climber, young_rider",
        )
        .order("tour_id")
        .order("rank")
        .range(from, to),
    ),
  ]);

  const tours = tourRows;
  const results = resultRows.filter((row) => !HIDDEN_PLAYERS.has(row.display_name));

  const resultsByTour = new Map<number, HistoricalResultRow[]>();
  for (const row of results) {
    const bucket = resultsByTour.get(row.tour_id);
    if (bucket) bucket.push(row);
    else resultsByTour.set(row.tour_id, [row]);
  }

  const events: PalmaresEvent[] = tours.map((tour) => {
    const rows = (resultsByTour.get(tour.tour_id) ?? [])
      .slice()
      .sort((a, b) => a.rank - b.rank);

    const jerseys: Partial<Record<JerseyId, Player>> = {};
    for (const jersey of JERSEYS) {
      const column = JERSEY_COLUMN[jersey];
      let best: HistoricalResultRow | null = null;
      for (const row of rows) {
        const points = row[column] as number;
        // Strictly greater, so a tie keeps the better-ranked team (rows are
        // sorted by rank). Zero never wins: the Classics score no jersey points
        // at all, which is exactly why they award no jersey.
        if (points > 0 && (best === null || points > (best[column] as number))) {
          best = row;
        }
      }
      if (best) jerseys[jersey] = toPlayer(best);
    }

    return {
      seasonYear: tour.season_year,
      eventType: tour.event_type,
      status: "played" as const,
      standings: rows.map((row) => ({ ...toPlayer(row), rank: row.rank })),
      jerseys,
    };
  });

  // Season standing: the highest total of raw points over the year's events.
  const tourById = new Map(tours.map((t) => [t.tour_id, t]));
  const pointsByYear = new Map<number, Map<string, { player: Player; points: number }>>();
  for (const row of results) {
    const tour = tourById.get(row.tour_id);
    if (!tour) continue;
    let byPlayer = pointsByYear.get(tour.season_year);
    if (!byPlayer) {
      byPlayer = new Map();
      pointsByYear.set(tour.season_year, byPlayer);
    }
    const entry = byPlayer.get(row.display_name);
    if (entry) entry.points += row.total;
    else byPlayer.set(row.display_name, { player: toPlayer(row), points: row.total });
  }

  const standings: SeasonStanding[] = [...pointsByYear.entries()]
    .map(([seasonYear, byPlayer]) => ({
      seasonYear,
      source: "archive" as const,
      isCurrent: false,
      note: null,
      ranking: [...byPlayer.values()]
        .sort((a, b) => b.points - a.points)
        .map((entry) => ({ ...entry.player, score: entry.points })),
    }))
    .sort((a, b) => b.seasonYear - a.seasonYear);

  return { events, standings };
}
