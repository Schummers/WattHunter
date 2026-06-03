import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  getCurrentGTPhase,
  GT_FULL_NAME,
  GT_IDENTIFIER,
  type GtPhaseId,
} from "@/lib/gt-phases";
import { getRaceBySlug } from "@/lib/calendar";

/**
 * The team's currently active race campaign — a GT phase or a 1-week
 * stage-race the team has built a squad for. Returned by
 * `getCurrentRaceCampaign`, consumed by `resolveRaceTeamLabel` and any
 * future feature that needs to know "what race is this team racing now?"
 */
export type RaceCampaign =
  | { kind: "gt"; phaseId: GtPhaseId; raceSlug: string; label: string }
  | { kind: "one_week"; raceSlug: string; label: string };

/**
 * Short toponym labels for the 1-week WT stage-races we track in 2026.
 * Used as `${label} Team` in the UI (e.g. "Dauphiné Team").
 *
 * Maintained by hand — keep in sync with `services/pcs-sync/wt_calendar_2026.json`
 * stage-race entries. When the calendar JSON moves to a new season, add the
 * 2027 slugs alongside (or rotate to a year-aware lookup).
 *
 * Slugs not in this map fall back to "Race Team" via
 * `resolveRaceTeamLabel`.
 */
export const ONE_WEEK_LABELS: Record<string, string> = {
  "race/paris-nice/2026": "Paris-Nice",
  "race/tirreno-adriatico/2026": "Tirreno",
  "race/itzulia-basque-country/2026": "Basque",
  "race/tour-de-romandie/2026": "Romandie",
  "race/dauphine/2026": "Dauphiné",
  "race/tour-de-suisse/2026": "Suisse",
  "race/tour-de-pologne/2026": "Pologne",
  "race/renewi-tour/2026": "Renewi",
  "race/tour-of-guangxi/2026": "Guangxi",
};

/**
 * Return the team's currently active race campaign, or `null` if no GT is
 * running and the team has no 1-week squad whose calendar window contains
 * `date`.
 *
 * Resolution order:
 *   1. **GT priority** — if a GT phase is active at `date`, return it. This
 *      wins even if the team also has a 1-week squad row (the GT label is the
 *      authoritative race for the team during its window).
 *   2. **1-week race** — load the team's `gt_squad` rows that have a
 *      non-null `race_slug` (post-A9), then return the first whose calendar
 *      window from `wt_calendar_2026.json` contains `date`.
 *   3. **Null** — no active campaign.
 */
export async function getCurrentRaceCampaign(
  supabase: SupabaseClient<Database>,
  teamId: string,
  date: Date = new Date(),
): Promise<RaceCampaign | null> {
  // (1) GT priority.
  const gt = getCurrentGTPhase(date);
  if (gt) {
    const phaseId = gt.id as GtPhaseId;
    const year = date.getFullYear();
    return {
      kind: "gt",
      phaseId,
      raceSlug: `race/${GT_IDENTIFIER[phaseId]}/${year}`,
      label: GT_FULL_NAME[phaseId],
    };
  }

  // (2) 1-week race detection from gt_squad.
  const { data: squadRows } = await supabase
    .from("gt_squad")
    .select("race_slug")
    .eq("team_id", teamId)
    .not("race_slug", "is", null);

  const slugs = Array.from(
    new Set(
      (squadRows ?? [])
        .map((r) => r.race_slug)
        .filter((s): s is string => typeof s === "string" && s.length > 0),
    ),
  );
  const today = date.toISOString().slice(0, 10);

  for (const slug of slugs) {
    const race = getRaceBySlug(slug);
    if (!race) continue;
    if (today >= race.startDate && today <= race.endDate) {
      return {
        kind: "one_week",
        raceSlug: slug,
        label: ONE_WEEK_LABELS[slug] ?? "Race",
      };
    }
  }

  // (3) Nothing active.
  return null;
}
