import type { SupabaseClient } from "@supabase/supabase-js";
import { HIDDEN_PLAYERS } from "./hidden-players";
import { loadHistoricalPalmares } from "./historical";
import { loadCurrentSeason } from "./current";
import { loadPlayerIdentities, type EquippedEmblem, type PlayerIdentity } from "./identity";
import type { JerseyId, PalmaresEvent, Player, SeasonStanding } from "./types";

export type { EquippedEmblem } from "./identity";

export interface PalmaresData {
  events: PalmaresEvent[];
  standings: SeasonStanding[];
  /** Equipped emblem per player, for the seasons that have one. */
  emblemByPlayer: Record<string, EquippedEmblem>;
  /** The signed-in player, used as the default of the Players tab. */
  viewerKey: string | null;
}

function visible<T extends { key: string }>(rows: T[]): T[] {
  return rows.filter((row) => !HIDDEN_PLAYERS.has(row.key));
}

/** Rewrites the label only. The key is the bridge between the two eras and
 *  never moves: renaming a team must not split a player's history in two. */
function relabel<T extends Player>(player: T, identities: Map<string, PlayerIdentity>): T {
  const identity = identities.get(player.key);
  return identity ? { ...player, displayName: identity.label } : player;
}

export async function loadPalmares(
  supabase: SupabaseClient,
  options: { seasonYear: number; viewerKey?: string | null } ,
): Promise<PalmaresData> {
  const [historical, current, identities] = await Promise.all([
    loadHistoricalPalmares(supabase),
    loadCurrentSeason(supabase, options.seasonYear),
    loadPlayerIdentities(supabase, { seasonYear: options.seasonYear }),
  ]);

  const events = [...current.events, ...historical.events].map((event) => {
    const jerseys: Partial<Record<JerseyId, Player>> = {};
    for (const [jersey, player] of Object.entries(event.jerseys)) {
      if (player) jerseys[jersey as JerseyId] = relabel(player, identities);
    }
    return {
      ...event,
      standings: visible(event.standings).map((row) => relabel(row, identities)),
      jerseys,
    };
  });

  const standings = [
    ...(current.standing ? [current.standing] : []),
    ...historical.standings,
  ]
    .map((season) => ({
      ...season,
      ranking: visible(season.ranking).map((row) => relabel(row, identities)),
    }))
    .sort((a, b) => b.seasonYear - a.seasonYear);

  const emblemByPlayer: Record<string, EquippedEmblem> = {};
  for (const [key, identity] of identities) {
    if (identity.emblem) emblemByPlayer[key] = identity.emblem;
  }

  return {
    events,
    standings,
    emblemByPlayer,
    viewerKey: options.viewerKey ?? null,
  };
}
