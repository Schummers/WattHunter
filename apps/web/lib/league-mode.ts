export type LeagueMode = "manager" | "classic";

/** Flat per-phase budget granted to every classic-mode team. */
export const CLASSIC_PHASE_BUDGET = 1_500_000;

/** Number of riders a classic-mode team drafts per phase (= GT role caps sum). */
export const CLASSIC_SQUAD_SIZE = 8;

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
