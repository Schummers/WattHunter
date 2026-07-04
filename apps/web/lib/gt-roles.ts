/**
 * Shared Grand Tour tactical-role vocabulary.
 *
 * The role→label map here uses singular, per-rider labels (e.g. "Domestique")
 * suitable for compact displays like the Peloton overview. The Race Team tab
 * keeps its own richer ROLE_ORDER (with slot caps + descriptions and plural
 * section headers) in team/gt/gt-team-client.tsx.
 */

export type GtRole =
  | "gc_leader"
  | "sprinter"
  | "climber"
  | "tt_specialist"
  | "stage_hunter"
  | "domestique"
  | "underdog";

export const GT_ROLE_LABELS: Record<GtRole, string> = {
  gc_leader: "GC Leader",
  sprinter: "Sprinter",
  climber: "Climber",
  tt_specialist: "TT Specialist",
  stage_hunter: "Stage Hunter",
  domestique: "Domestique",
  underdog: "Underdog",
};

/** Human label for a tactical role, or `null` if the rider has no assignment. */
export function gtRoleLabel(role: GtRole | null | undefined): string | null {
  return role ? GT_ROLE_LABELS[role] : null;
}
