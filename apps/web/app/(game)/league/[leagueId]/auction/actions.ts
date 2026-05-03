"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { calcMinSalary } from "@/lib/format";
import { getCurrentPhase } from "@/lib/phases";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const AddDraftSchema = z.object({
  leagueId: z.string().uuid(),
  riderId: z.string().uuid(),
  amount: z
    .number()
    .int()
    .min(5000, "Minimum bid is 5 000 €")
    .refine((v) => v % 100 === 0, "Amount must be a multiple of 100"),
});

const RemoveDraftSchema = z.object({
  leagueId: z.string().uuid(),
  riderId: z.string().uuid(),
});

const UpdateDraftAmountSchema = z.object({
  leagueId: z.string().uuid(),
  riderId: z.string().uuid(),
  amount: z
    .number()
    .int()
    .min(5000, "Minimum bid is 5 000 €")
    .refine((v) => v % 100 === 0, "Amount must be a multiple of 100"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the calling user's team in a given league. */
async function getTeamForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  leagueId: string
) {
  const { data: member } = await supabase
    .from("league_members")
    .select("team_id")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .single();

  if (!member?.team_id) return null;
  return member.team_id as string;
}

// ---------------------------------------------------------------------------
// addDraft
// ---------------------------------------------------------------------------

export async function addDraft(input: {
  leagueId: string;
  riderId: string;
  amount: number;
}) {
  const parsed = AddDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const { leagueId, riderId, amount } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const teamId = await getTeamForUser(supabase, user.id, leagueId);
  if (!teamId) return { error: "Team not found" };

  // Fetch rider to compute min salary
  const { data: rider } = await supabase
    .from("riders")
    .select("pcs_points_1yr")
    .eq("id", riderId)
    .single();

  if (!rider) return { error: "Rider not found" };

  const minSalary = calcMinSalary(rider.pcs_points_1yr ?? 0);
  if (amount < minSalary) {
    return { error: `Minimum bid for this rider is ${minSalary.toLocaleString("en-GB")} €` };
  }

  // Verify rider is NOT already in the roster
  const { data: activeContract } = await supabase
    .from("contracts")
    .select("id")
    .eq("team_id", teamId)
    .eq("rider_id", riderId)
    .eq("status", "active")
    .maybeSingle();

  if (activeContract) {
    return { error: "Rider is already on your roster" };
  }

  // Upsert draft bid
  const { error: upsertError } = await supabase
    .from("draft_bids")
    .upsert(
      { team_id: teamId, rider_id: riderId, league_id: leagueId, amount },
      { onConflict: "team_id,rider_id" }
    );

  if (upsertError) return { error: upsertError.message };

  revalidatePath(`/league/${leagueId}/auction`);
  revalidatePath(`/league/${leagueId}/auction/market`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// removeDraft
// ---------------------------------------------------------------------------

export async function removeDraft(input: {
  leagueId: string;
  riderId: string;
}) {
  const parsed = RemoveDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const { leagueId, riderId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const teamId = await getTeamForUser(supabase, user.id, leagueId);
  if (!teamId) return { error: "Team not found" };

  const { error: deleteError } = await supabase
    .from("draft_bids")
    .delete()
    .eq("team_id", teamId)
    .eq("rider_id", riderId);

  if (deleteError) return { error: deleteError.message };

  revalidatePath(`/league/${leagueId}/auction`);
  revalidatePath(`/league/${leagueId}/auction/market`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// updateDraftAmount
// ---------------------------------------------------------------------------

export async function updateDraftAmount(input: {
  leagueId: string;
  riderId: string;
  amount: number;
}) {
  const parsed = UpdateDraftAmountSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const { leagueId, riderId, amount } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const teamId = await getTeamForUser(supabase, user.id, leagueId);
  if (!teamId) return { error: "Team not found" };

  // Fetch rider to validate amount against min salary
  const { data: rider } = await supabase
    .from("riders")
    .select("pcs_points_1yr")
    .eq("id", riderId)
    .single();

  if (!rider) return { error: "Rider not found" };

  const minSalary = calcMinSalary(rider.pcs_points_1yr ?? 0);
  if (amount < minSalary) {
    return { error: `Minimum bid for this rider is ${minSalary.toLocaleString("en-GB")} €` };
  }

  const { error: updateError } = await supabase
    .from("draft_bids")
    .update({ amount })
    .eq("team_id", teamId)
    .eq("rider_id", riderId);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/league/${leagueId}/auction`);
  revalidatePath(`/league/${leagueId}/auction/market`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// validateRound
// ---------------------------------------------------------------------------

const ValidateRoundSchema = z.object({
  leagueId: z.string().uuid(),
});

export async function validateRound(input: { leagueId: string }) {
  const parsed = ValidateRoundSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const { leagueId } = parsed.data;

  const supabase = await createClient();
  const currentPhase = getCurrentPhase();

  const { data, error } = await supabase.rpc("validate_round", {
    p_league_id: leagueId,
    p_current_phase_id: currentPhase.id,
  });

  if (error) return { error: error.message };

  const result = data as { ok?: boolean; error?: string; inserted?: number } | null;
  if (!result?.ok) return { error: result?.error ?? "Validation failed" };

  revalidatePath(`/league/${leagueId}/auction`);
  return { success: true };
}
