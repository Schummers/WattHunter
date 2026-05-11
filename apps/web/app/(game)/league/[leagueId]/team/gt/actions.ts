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

type RpcResult = { ok?: boolean; error?: string } | null;
export type ActionResponse = { ok: true } | { error: string };

function extractError(fn: string, data: unknown, error: { message: string } | null): string | null {
  if (error) return error.message;
  const result = data as RpcResult;
  if (!result?.ok) return result?.error ?? `${fn} failed`;
  return null;
}

async function getTeamLeagueId(teamId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select("league_id")
    .eq("id", teamId)
    .maybeSingle();
  return (data?.league_id as string | null) ?? null;
}

/**
 * Add a roster rider to a specific role slot in the GT squad.
 */
export async function addToSquad({
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
}): Promise<ActionResponse> {
  if (!UUID.safeParse(teamId).success || !UUID.safeParse(riderId).success ||
      !RoleSchema.safeParse(role).success || !PhaseIdSchema.safeParse(phaseId).success) {
    return { error: "Invalid data" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gt_add_to_squad", {
    p_team_id: teamId,
    p_rider_id: riderId,
    p_role: role,
    p_phase_id: phaseId,
    p_year: year,
  });

  const err = extractError("gt_add_to_squad", data, error);
  if (err) return { error: err };

  const leagueId = await getTeamLeagueId(teamId);
  if (leagueId) revalidatePath(`/league/${leagueId}/team/gt`);
  return { ok: true };
}

/**
 * Remove a rider from the GT squad (soft-delete).
 */
export async function removeFromSquad({
  teamId,
  riderId,
  phaseId,
  year,
}: {
  teamId: string;
  riderId: string;
  phaseId: GtPhaseId;
  year: number;
}): Promise<ActionResponse> {
  if (!UUID.safeParse(teamId).success || !UUID.safeParse(riderId).success ||
      !PhaseIdSchema.safeParse(phaseId).success) {
    return { error: "Invalid data" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gt_remove_from_squad", {
    p_team_id: teamId,
    p_rider_id: riderId,
    p_phase_id: phaseId,
    p_year: year,
  });

  const err = extractError("gt_remove_from_squad", data, error);
  if (err) return { error: err };

  const leagueId = await getTeamLeagueId(teamId);
  if (leagueId) revalidatePath(`/league/${leagueId}/team/gt`);
  return { ok: true };
}

/**
 * Swap a rider in a slot with another from the roster. The new rider inherits the role.
 */
export async function swapSlot({
  teamId,
  oldRiderId,
  newRiderId,
  phaseId,
  year,
}: {
  teamId: string;
  oldRiderId: string;
  newRiderId: string;
  phaseId: GtPhaseId;
  year: number;
}): Promise<ActionResponse> {
  if (!UUID.safeParse(teamId).success || !UUID.safeParse(oldRiderId).success ||
      !UUID.safeParse(newRiderId).success || !PhaseIdSchema.safeParse(phaseId).success) {
    return { error: "Invalid data" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gt_swap_slot", {
    p_team_id: teamId,
    p_old_rider_id: oldRiderId,
    p_new_rider_id: newRiderId,
    p_phase_id: phaseId,
    p_year: year,
  });

  const err = extractError("gt_swap_slot", data, error);
  if (err) return { error: err };

  const leagueId = await getTeamLeagueId(teamId);
  if (leagueId) revalidatePath(`/league/${leagueId}/team/gt`);
  return { ok: true };
}

/**
 * Change a squad rider's role. If assigning a capped role, the OLDEST
 * existing holder (by created_at) is demoted to `domestique` first.
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
}): Promise<ActionResponse> {
  if (!UUID.safeParse(teamId).success || !UUID.safeParse(riderId).success ||
      !RoleSchema.safeParse(role).success || !PhaseIdSchema.safeParse(phaseId).success) {
    return { error: "Invalid data" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gt_assign_role", {
    p_team_id: teamId,
    p_rider_id: riderId,
    p_role: role,
    p_phase_id: phaseId,
    p_year: year,
  });

  const err = extractError("gt_assign_role", data, error);
  if (err) return { error: err };

  const leagueId = await getTeamLeagueId(teamId);
  if (leagueId) revalidatePath(`/league/${leagueId}/team/gt`);
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
 * Claim a 50% salary refund for a DNF rider in the GT squad.
 * Also forfeits any XP accumulated during the GT.
 */
export async function claimDnfRefund(
  gtSquadId: string,
  contractId: string
): Promise<{ ok: boolean; refund_amount: number; xp_forfeited: number } | { error: string }> {
  if (!UUID.safeParse(gtSquadId).success || !UUID.safeParse(contractId).success) {
    return { error: "Invalid data" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gt_claim_dnf_refund", {
    p_gt_squad_id: gtSquadId,
    p_contract_id: contractId,
  });

  if (error) return { error: error.message };
  return data as { ok: boolean; refund_amount: number; xp_forfeited: number };
}

/**
 * Read-only snapshot: squad + role + XP accumulated for this GT.
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
      "rider_id, role, riders:rider_id(id, full_name, nationality, real_team, pcs_rank, photo_url)"
    )
    .eq("team_id", teamId)
    .eq("phase_id", phaseId)
    .eq("year", year)
    .is("removed_at", null);

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
    role: GtRole;
    riders: RiderRow | RiderRow[] | null;
  }>)
    .filter((s) => activeRiderIds.has(s.rider_id))
    .map((s) => {
      const rider = Array.isArray(s.riders) ? s.riders[0] : s.riders;
      return {
        riderId: s.rider_id,
        role: s.role,
        xp: Math.round(xpMap.get(s.rider_id) ?? 0),
        rider,
      };
    });
}

/**
 * Returns active-contract riders NOT currently in the GT squad.
 */
export async function getAvailableRiders({
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

  const { data: contracts } = await supabase
    .from("contracts")
    .select(
      "rider_id, riders:rider_id(id, full_name, nationality, real_team, pcs_rank, photo_url, pcs_points_1yr)"
    )
    .eq("team_id", teamId)
    .eq("status", "active");

  const { data: squadRows } = await supabase
    .from("gt_squad")
    .select("rider_id")
    .eq("team_id", teamId)
    .eq("phase_id", phaseId)
    .eq("year", year)
    .is("removed_at", null);

  const inSquad = new Set(
    (squadRows ?? []).map((s) => (s as { rider_id: string }).rider_id)
  );

  type AvailableRider = {
    id: string;
    full_name: string;
    nationality: string | null;
    real_team: string | null;
    pcs_rank: number | null;
    photo_url: string | null;
    pcs_points_1yr: number | null;
  };

  return ((contracts ?? []) as Array<{
    rider_id: string;
    riders: AvailableRider | AvailableRider[] | null;
  }>)
    .filter((c) => c.rider_id && !inSquad.has(c.rider_id))
    .map((c) => {
      const rider = Array.isArray(c.riders) ? c.riders[0] : c.riders;
      return {
        riderId: c.rider_id,
        rider,
      };
    })
    .sort((a, b) => {
      const ptsA = a.rider?.pcs_points_1yr ?? 0;
      const ptsB = b.rider?.pcs_points_1yr ?? 0;
      return ptsB - ptsA;
    });
}
