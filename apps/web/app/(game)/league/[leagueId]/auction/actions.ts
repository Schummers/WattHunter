"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { calcMinSalary } from "@/lib/format";
import { getCurrentPhase } from "@/lib/phases";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEVELS } from "@/lib/levels";

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

// ---------------------------------------------------------------------------
// forceResolveRound — port of services/pcs-sync/auction.py::resolve_current_round
// ---------------------------------------------------------------------------

const ForceResolveSchema = z.object({
  leagueId: z.string().uuid(),
});

interface ResolvedAuction {
  id: string;
  name: string;
  league_id: string;
}

interface ActiveBid {
  id: string;
  rider_id: string;
  team_id: string;
  amount: number;
  placed_at: string;
}

/**
 * Returns the minimum PCS rank a rider must have for a team at this level
 * to be allowed to bid. e.g. level 1 → 300 means riders ranked 1-299 are
 * blocked. Mirrors `LEVEL_POOL_MIN` in services/pcs-sync/sync.py.
 */
function poolMinForLevel(level: number): number {
  const idx = Math.max(0, Math.min(level, 8) - 1);
  return LEVELS[idx].poolMin;
}

export async function forceResolveRound(input: { leagueId: string }) {
  const parsed = ForceResolveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const { leagueId } = parsed.data;

  // 1. Auth (anon client)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // 2. Membership check (anon client + RLS)
  const { data: membership } = await supabase
    .from("league_members")
    .select("team_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return { error: "Not a member of this league" };
  }

  // 3. Switch to admin client for mutations
  const admin = createAdminClient();
  const phase = getCurrentPhase();
  const today = new Date().toISOString().slice(0, 10);

  // 4. Optimistic lock: claim the open auction by transitioning to 'closed'.
  //    Concurrent calls will match 0 rows on this UPDATE (since status is
  //    no longer 'open' after the first call commits) and return [].
  const { data: lockedRows, error: lockErr } = await admin
    .from("auctions")
    .update({ status: "closed", resolved_at: new Date().toISOString() })
    .eq("league_id", leagueId)
    .eq("status", "open")
    .select("id, name, league_id");

  if (lockErr) return { error: lockErr.message };

  const auctions = (lockedRows ?? []) as ResolvedAuction[];
  if (auctions.length === 0) {
    return { error: "No open round to resolve (already closed?)" };
  }
  // Should only ever be 1 open auction per league; iterate defensively.
  const auction = auctions[0];

  // 5. Fetch all active bids for this auction
  const { data: bidsRaw, error: bidsErr } = await admin
    .from("auction_bids")
    .select("id, rider_id, team_id, amount, placed_at")
    .eq("auction_id", auction.id)
    .eq("status", "active");

  if (bidsErr) return { error: bidsErr.message };

  const bids = (bidsRaw ?? []) as ActiveBid[];

  // 6. Group by rider_id
  const byRider = new Map<string, ActiveBid[]>();
  for (const bid of bids) {
    const list = byRider.get(bid.rider_id) ?? [];
    list.push(bid);
    byRider.set(bid.rider_id, list);
  }

  const isRound1 = /round 1/i.test(auction.name);
  let resolvedCount = 0;

  // 7. For each rider — winner + losers.
  //    Each iteration is wrapped in try/catch: a single rider failure
  //    must not abort the whole resolve. Mirrors Python's per-rider try/except
  //    in services/pcs-sync/auction.py:136-264.
  const riderErrors: Array<{ riderId: string; error: string }> = [];
  for (const [riderId, riderBids] of byRider.entries()) {
    try {
      // Sort: highest amount first, tiebreak earliest placed_at
      riderBids.sort((a, b) => {
        if (b.amount !== a.amount) return b.amount - a.amount;
        return a.placed_at.localeCompare(b.placed_at);
      });
      const winner = riderBids[0];
      const losers = riderBids.slice(1);

      // 7a. Fetch rider for level gating
      const { data: rider } = await admin
        .from("riders")
        .select("id, full_name, pcs_rank")
        .eq("id", riderId)
        .maybeSingle();

      // 7b. Fetch winner team for level
      const { data: team } = await admin
        .from("teams")
        .select("id, level, treasury")
        .eq("id", winner.team_id)
        .maybeSingle();

      const teamLevel = team?.level ?? 1;
      const riderRank = rider?.pcs_rank ?? null;
      const poolMin = poolMinForLevel(teamLevel);

      // 7c. Level gating
      if (riderRank !== null && riderRank < poolMin) {
        // Cancel all bids for this rider
        await admin
          .from("auction_bids")
          .update({ status: "cancelled" })
          .eq("auction_id", auction.id)
          .eq("rider_id", riderId)
          .eq("status", "active");
        continue;
      }

      // 7d. Duplicate-contract guard
      const { data: existing } = await admin
        .from("contracts")
        .select("id")
        .eq("rider_id", riderId)
        .eq("league_id", leagueId)
        .in("status", ["active", "notice"])
        .maybeSingle();

      if (existing) {
        await admin
          .from("auction_bids")
          .update({ status: "cancelled" })
          .eq("auction_id", auction.id)
          .eq("rider_id", riderId)
          .eq("status", "active");
        continue;
      }

      // 7e. Mark winner won
      await admin
        .from("auction_bids")
        .update({ status: "won" })
        .eq("id", winner.id);

      // 7f. Mark loser bids outbid (skip when there are no losers — `.in("id", [])`
      //     is NOT a safe no-op in PostgREST and may error)
      if (losers.length > 0) {
        await admin
          .from("auction_bids")
          .update({ status: "outbid" })
          .in(
            "id",
            losers.map((l) => l.id)
          );
      }

      // 7g. Create contract
      await admin.from("contracts").insert({
        team_id: winner.team_id,
        rider_id: riderId,
        league_id: leagueId,
        locked_salary: winner.amount,
        status: "active",
        purchased_at: new Date().toISOString(),
        last_salary_paid: today,
        phase_recruited_id: phase.id,
      });

      // 7h. Mark rider active in game
      await admin
        .from("riders")
        .update({ is_active_in_game: true })
        .eq("id", riderId);

      // 7i. Treasury deduction (Round 2+ only — Round 1 deferred to confirmPhaseSetup)
      if (!isRound1 && team) {
        const newTreasury = (team.treasury ?? 0) - winner.amount;
        await admin
          .from("teams")
          .update({ treasury: newTreasury })
          .eq("id", winner.team_id);

        await admin.from("treasury_log").insert({
          team_id: winner.team_id,
          rider_id: riderId,
          type: "payday_salary",
          amount: -winner.amount,
          description: `Salary — ${rider?.full_name ?? riderId} (${auction.name})`,
        });
      }

      resolvedCount++;
    } catch (err) {
      // Log + continue with next rider. The auction is already 'closed'
      // from the optimistic lock (step 4), so we always run cleanup +
      // open-next regardless of how many riders fail.
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[forceResolveRound] rider ${riderId}: ${message}`);
      riderErrors.push({ riderId, error: message });
    }
  }

  // 8. Cleanup stale draft_bids for riders that now have active contracts
  //    in this league. Mirrors auction.py::_cleanup_stale_drafts.
  const { data: contracts } = await admin
    .from("contracts")
    .select("rider_id")
    .eq("league_id", leagueId)
    .eq("status", "active");

  const contractedRiderIds = (contracts ?? []).map((c) => c.rider_id);

  if (contractedRiderIds.length > 0) {
    // Filter draft_bids by league + rider_id list. Drafts are bound to a
    // (team, rider) pair; a single .in() on rider_id is enough since drafts
    // are scoped by league_id too.
    await admin
      .from("draft_bids")
      .delete()
      .eq("league_id", leagueId)
      .in("rider_id", contractedRiderIds);
  }

  // 9. Open next scheduled auction in this league (if any)
  const { data: nextAuction } = await admin
    .from("auctions")
    .select("id")
    .eq("league_id", leagueId)
    .eq("status", "scheduled")
    .order("opens_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let nextAuctionId: string | null = null;
  if (nextAuction) {
    nextAuctionId = nextAuction.id;
    await admin
      .from("auctions")
      .update({ status: "open", opens_at: new Date().toISOString() })
      .eq("id", nextAuction.id);
  }

  // 10. Revalidate
  revalidatePath(`/league/${leagueId}`);
  revalidatePath(`/league/${leagueId}/auction`);
  revalidatePath(`/league/${leagueId}/auction/status`);
  revalidatePath(`/league/${leagueId}/auction/history`);

  return { ok: true, resolved: resolvedCount, next_auction_id: nextAuctionId };
}
