export type LeagueMode = "manager" | "classic";

/** Flat per-phase budget granted to every classic-mode team. */
export const CLASSIC_PHASE_BUDGET = 2_000_000;

/** Number of riders a classic-mode team drafts per phase (= GT role caps sum:
 *  1 GC + 1 sprint + 1 climb + 1 TT + 2 stage hunters + 2 domestiques + 2 wildcards). */
export const CLASSIC_SQUAD_SIZE = 10;

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
