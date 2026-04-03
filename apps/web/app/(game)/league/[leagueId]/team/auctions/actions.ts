"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { calcMinSalary } from "@/lib/format";
import { getMaxSlots } from "@/lib/levels";

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

  revalidatePath(`/league/${leagueId}/team/auctions`);
  revalidatePath(`/league/${leagueId}/team/market`);
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

  revalidatePath(`/league/${leagueId}/team/auctions`);
  revalidatePath(`/league/${leagueId}/team/market`);
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

  revalidatePath(`/league/${leagueId}/team/auctions`);
  revalidatePath(`/league/${leagueId}/team/market`);
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // --- 1. Resolve team ---
  const teamId = await getTeamForUser(supabase, user.id, leagueId);
  if (!teamId) return { error: "Team not found" };

  const { data: team } = await supabase
    .from("teams")
    .select("id, treasury, level")
    .eq("id", teamId)
    .single();

  if (!team) return { error: "Team not found" };

  // --- 2. Find open auction round for this league ---
  const { data: auction } = await supabase
    .from("auctions")
    .select("id, name")
    .eq("league_id", leagueId)
    .eq("status", "open")
    .order("opens_at", { ascending: true })
    .limit(1)
    .single();

  if (!auction) return { error: "No open auction round found" };

  const auctionRound = parseInt(auction.name.match(/\d+/)?.[0] ?? "0", 10);

  // --- 3. Get draft bids for this team + league ---
  const { data: drafts, error: draftsError } = await supabase
    .from("draft_bids")
    .select("id, rider_id, amount")
    .eq("team_id", teamId)
    .eq("league_id", leagueId);

  if (draftsError) return { error: draftsError.message };
  const draftList = drafts ?? [];

  // --- 4. Get active contracts ---
  const { data: contracts, error: contractsError } = await supabase
    .from("contracts")
    .select("id, locked_salary")
    .eq("team_id", teamId)
    .eq("status", "active");

  if (contractsError) return { error: contractsError.message };
  const contractList = contracts ?? [];

  // --- 5. Calculate financials ---
  const rosterSalaries = contractList.reduce(
    (sum, c) => sum + (c.locked_salary ?? 0),
    0
  );
  const draftTotal = draftList.reduce((sum, d) => sum + d.amount, 0);

  // --- 6. Get sponsor monthly_budget ---
  const { data: teamSponsor } = await supabase
    .from("team_sponsors")
    .select("sponsor_id, sponsors(monthly_budget, name)")
    .eq("team_id", teamId)
    .single();

  const rawSponsor = teamSponsor?.sponsors;
  const sponsorData = Array.isArray(rawSponsor) ? rawSponsor[0] : rawSponsor;
  const sponsorIncome =
    (sponsorData as { monthly_budget: number } | null | undefined)
      ?.monthly_budget ?? 250_000;

  // --- 7. Budget check: treasury + sponsorIncome - rosterSalaries - draftTotal >= 0 ---
  const remaining = team.treasury + sponsorIncome - rosterSalaries - draftTotal;
  if (remaining < 0) {
    return {
      error: `Budget exceeded: your bids total ${(
        rosterSalaries + draftTotal
      ).toLocaleString("en-GB")} € but available funds (treasury + sponsor income) are ${(team.treasury + sponsorIncome).toLocaleString("en-GB")} €`,
    };
  }

  // --- 8. Slot check ---
  const maxSlots = getMaxSlots(team.level);
  const rosterCount = contractList.length;
  const draftCount = draftList.length;
  if (rosterCount + draftCount > maxSlots) {
    return {
      error: `Roster limit exceeded: ${rosterCount} active + ${draftCount} new bids = ${
        rosterCount + draftCount
      } riders, but your level allows ${maxSlots} slots`,
    };
  }

  // --- 9. Convert drafts → auction_bids ---
  if (draftList.length > 0) {
    const auctionBids = draftList.map((draft) => ({
      auction_id: auction.id,
      team_id: teamId,
      rider_id: draft.rider_id,
      amount: draft.amount,
      round: auctionRound,
      status: "active" as const,
    }));

    const { error: insertError } = await supabase
      .from("auction_bids")
      .insert(auctionBids);

    if (insertError) return { error: insertError.message };
  }

  // --- 10. Clear drafts ---
  const { error: deleteError } = await supabase
    .from("draft_bids")
    .delete()
    .eq("team_id", teamId)
    .eq("league_id", leagueId);

  if (deleteError) return { error: deleteError.message };

  revalidatePath(`/league/${leagueId}/team/auctions`);
  revalidatePath(`/league/${leagueId}/auctions`);
  return { success: true };
}
