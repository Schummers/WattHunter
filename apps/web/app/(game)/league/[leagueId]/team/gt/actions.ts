"use server";

import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const ROLES = [
  "gc_leader",
  "sprinter",
  "climber",
  "tt_specialist",
  "stage_hunter",
  "domestique",
] as const;

export type GtRole = (typeof ROLES)[number];
export type GtPhaseId = 4 | 6 | 8;

const RoleSchema = z.enum(ROLES);
const UUID = z.string().uuid();
const PhaseIdSchema = z.union([z.literal(4), z.literal(6), z.literal(8)]);

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Max riders per role within a squad. Stage Hunter gets 2; all other non-domestique roles are 1.
const ROLE_CAP: Record<Exclude<GtRole, "domestique">, number> = {
  gc_leader: 1,
  sprinter: 1,
  climber: 1,
  tt_specialist: 1,
  stage_hunter: 2,
};

async function requireOwner(teamId: string) {
  UUID.parse(teamId);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: team, error } = await supabase
    .from("teams")
    .select("id, user_id, league_id")
    .eq("id", teamId)
    .single();
  if (error || !team) throw new Error("Team not found");
  if (team.user_id !== user.id) throw new Error("Not team owner");
  return { supabase, team };
}

/**
 * Latest role per rider for (team, phase, year). `order by applied_at desc, first wins`.
 */
async function latestRolesMap(
  supabase: SupabaseClient,
  teamId: string,
  phaseId: GtPhaseId,
  year: number
) {
  const { data } = await supabase
    .from("gt_role_assignments")
    .select("rider_id, role, applied_at")
    .eq("team_id", teamId)
    .eq("phase_id", phaseId)
    .eq("year", year)
    .order("applied_at", { ascending: false });
  const map = new Map<string, GtRole>();
  for (const row of (data ?? []) as Array<{ rider_id: string; role: GtRole }>) {
    if (!map.has(row.rider_id)) map.set(row.rider_id, row.role);
  }
  return map;
}

/**
 * Lazy-create the 8-rider squad for this team/phase/year if empty.
 * Picks the top 8 active-contract riders by pcs_points_1yr.
 */
export async function ensureGtSquad({
  teamId,
  phaseId,
  year,
}: {
  teamId: string;
  phaseId: GtPhaseId;
  year: number;
}) {
  UUID.parse(teamId);
  PhaseIdSchema.parse(phaseId);
  const { supabase } = await requireOwner(teamId);

  const { data: existing } = await supabase
    .from("gt_squad")
    .select("rider_id")
    .eq("team_id", teamId)
    .eq("phase_id", phaseId)
    .eq("year", year);
  if (existing && existing.length > 0) return { inserted: 0 };

  const { data: contracts } = await supabase
    .from("contracts")
    .select("rider_id, riders:rider_id(pcs_points_1yr)")
    .eq("team_id", teamId)
    .eq("status", "active");

  const active = ((contracts ?? []) as Array<{
    rider_id: string | null;
    riders: { pcs_points_1yr: number | null } | Array<{ pcs_points_1yr: number | null }> | null;
  }>)
    .filter((c) => c.rider_id)
    .map((c) => {
      const rider = Array.isArray(c.riders) ? c.riders[0] : c.riders;
      return {
        rider_id: c.rider_id as string,
        pts: Number(rider?.pcs_points_1yr ?? 0),
      };
    })
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 8);

  if (active.length === 0) return { inserted: 0 };

  const squadRows = active.map((r) => ({
    team_id: teamId,
    phase_id: phaseId,
    year,
    rider_id: r.rider_id,
  }));
  await supabase.from("gt_squad").insert(squadRows);

  const roleRows = active.map((r) => ({
    team_id: teamId,
    phase_id: phaseId,
    year,
    rider_id: r.rider_id,
    role: "domestique" as GtRole,
  }));
  await supabase.from("gt_role_assignments").insert(roleRows);

  return { inserted: active.length };
}

/**
 * Append a new role for a squad rider. If assigning a capped role, the oldest
 * existing holder over the cap is demoted to `domestique` first (append-only).
 */
export async function assignRole({
  teamId,
  riderId,
  role,
  phaseId,
  year,
}: {
  teamId: string;
  riderId: string;
  role: GtRole;
  phaseId: GtPhaseId;
  year: number;
}) {
  UUID.parse(teamId);
  UUID.parse(riderId);
  RoleSchema.parse(role);
  PhaseIdSchema.parse(phaseId);
  const { supabase, team } = await requireOwner(teamId);

  // Rider must belong to the squad.
  const { data: squad } = await supabase
    .from("gt_squad")
    .select("rider_id")
    .eq("team_id", teamId)
    .eq("phase_id", phaseId)
    .eq("year", year);
  const ids = ((squad ?? []) as Array<{ rider_id: string }>).map((r) => r.rider_id);
  if (!ids.includes(riderId)) throw new Error("Rider not in squad");

  // Enforce capacity for non-domestique roles by demoting the oldest existing holder.
  if (role !== "domestique") {
    const cap = ROLE_CAP[role as Exclude<GtRole, "domestique">];
    const latestPerRider = await latestRolesMap(supabase, teamId, phaseId, year);
    const holders = [...latestPerRider.entries()]
      .filter(([rid, r]) => r === role && rid !== riderId)
      .map(([rid]) => rid);
    if (holders.length >= cap) {
      const demoteId = holders[0];
      await supabase.from("gt_role_assignments").insert({
        team_id: teamId,
        rider_id: demoteId,
        phase_id: phaseId,
        year,
        role: "domestique",
      });
    }
  }

  await supabase.from("gt_role_assignments").insert({
    team_id: teamId,
    rider_id: riderId,
    phase_id: phaseId,
    year,
    role,
  });

  if (team.league_id) {
    revalidatePath(`/league/${team.league_id}/team/gt`);
  }
  return { ok: true };
}

export async function clearRole(input: {
  teamId: string;
  riderId: string;
  phaseId: GtPhaseId;
  year: number;
}) {
  return assignRole({ ...input, role: "domestique" });
}

/**
 * Read-only snapshot used by the GT Team page: squad + current role + XP
 * accumulated for this GT.
 */
export async function getSquadWithRoles({
  teamId,
  phaseId,
  year,
}: {
  teamId: string;
  phaseId: GtPhaseId;
  year: number;
}) {
  UUID.parse(teamId);
  PhaseIdSchema.parse(phaseId);
  const supabase = await createClient();

  const { data: squad } = await supabase
    .from("gt_squad")
    .select(
      "rider_id, riders:rider_id(id, full_name, nationality, real_team, pcs_rank, photo_url)"
    )
    .eq("team_id", teamId)
    .eq("phase_id", phaseId)
    .eq("year", year);

  const roles = await latestRolesMap(supabase, teamId, phaseId, year);

  const slugPrefix =
    phaseId === 4
      ? "race/giro-d-italia/"
      : phaseId === 6
        ? "race/tour-de-france/"
        : "race/vuelta-a-espana/";
  const { data: xpRows } = await supabase
    .from("rider_xp_daily")
    .select("rider_id, xp_gained, race_slug")
    .eq("team_id", teamId)
    .like("race_slug", `${slugPrefix}${year}%`);

  const xpMap = new Map<string, number>();
  for (const r of (xpRows ?? []) as Array<{ rider_id: string; xp_gained: number | null }>) {
    xpMap.set(r.rider_id, (xpMap.get(r.rider_id) ?? 0) + Number(r.xp_gained ?? 0));
  }

  const { data: activeContracts } = await supabase
    .from("contracts")
    .select("rider_id")
    .eq("team_id", teamId)
    .eq("status", "active");
  const activeRiderIds = new Set(
    (activeContracts ?? []).map((c) => (c as { rider_id: string }).rider_id)
  );

  type RiderRow = {
    id: string;
    full_name: string;
    nationality: string | null;
    real_team: string | null;
    pcs_rank: number | null;
    photo_url: string | null;
  };

  return ((squad ?? []) as Array<{
    rider_id: string;
    riders: RiderRow | RiderRow[] | null;
  }>)
    .filter((s) => activeRiderIds.has(s.rider_id))
    .map((s) => {
    const rider = Array.isArray(s.riders) ? s.riders[0] : s.riders;
    return {
      riderId: s.rider_id,
      role: (roles.get(s.rider_id) ?? "domestique") as GtRole,
      xp: Math.round(xpMap.get(s.rider_id) ?? 0),
      rider,
    };
  });
}
