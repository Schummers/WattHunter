export type LeagueMode = "manager" | "classic";

/** Flat per-phase budget granted to every classic-mode team. */
export const CLASSIC_PHASE_BUDGET = 2_000_000;

/** Number of riders a classic-mode team drafts per phase (= GT role caps sum:
 *  1 GC + 1 sprint + 1 climb + 1 TT + 2 stage hunters + 2 domestiques + 2 underdogs). */
export const CLASSIC_SQUAD_SIZE = 10;

/**
 * Auction rounds intended per phase. A league that fills every squad sooner
 * ends the phase early (see `league_all_teams_complete`), so this is a ceiling,
 * not a target. Kept under 8: `place_bid` rejects a higher round number and
 * `auction_bids.round` carries a CHECK (1..8).
 *
 * NOTE: nothing currently provisions this many rounds automatically.
 * `launch_first_auction` creates exactly 3, once, for a league's first phase;
 * later phases get whatever the commissioner creates by hand (or, for the
 * 2026-08 Vuelta phase, whatever was inserted directly). Rounds 4-5 only exist
 * once someone explicitly adds them. Round auto-provisioning on phase start is
 * tracked in the vault (see the task about not porting the commissioner dates
 * form to iOS) — until it ships, this constant documents intent, not reality.
 */
export const ROUNDS_PER_PHASE = 5;

export function isClassic(mode: LeagueMode | null | undefined): boolean {
  return mode === "classic";
}

/** Team seed values for a classic-mode league (pure, testable). */
export function classicTeamDefaults() {
  return {
    starting_level: 8,
    treasury: CLASSIC_PHASE_BUDGET,
    underdog_eligible: false,
    assignSponsor: false,
  } as const;
}

/** Picks the phase-transition RPC for a league mode (pure router). */
export function phaseResetRpcFor(
  mode: LeagueMode,
): "classic_phase_reset" | "confirm_phase_setup" {
  return isClassic(mode) ? "classic_phase_reset" : "confirm_phase_setup";
}
