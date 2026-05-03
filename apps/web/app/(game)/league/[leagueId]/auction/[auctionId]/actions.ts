"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { computeCoUnlockStatus, fetchLeagueTeamLevels } from "@/lib/co-unlock";
import { getLevelByNumber, getMaxSlots } from "@/lib/levels";

function minRankForLevel(level: number): number {
  return getLevelByNumber(level).poolMin;
}

const BidSchema = z.object({
  auctionId: z.string().uuid(),
  riderId: z.string().uuid(),
  amount: z.number().int().positive().max(100_000_000),
  round: z.number().int().min(1).max(3),
});

export async function placeBid(input: z.infer<typeof BidSchema>) {
  const parsed = BidSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid data" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Get auction's league_id to scope team lookup
  const { data: auction } = await supabase
    .from("auctions")
    .select("league_id, status, closes_at")
    .eq("id", parsed.data.auctionId)
    .single();

  if (!auction) return { error: "Auction not found" };
  if (auction.status !== "open") return { error: "Auction is not open" };
  if (auction.closes_at && new Date(auction.closes_at) < new Date()) {
    return { error: "Auction bidding period has ended" };
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id, treasury, level")
    .eq("user_id", user.id)
    .eq("league_id", auction.league_id)
    .single();

  if (!team) return { error: "Team not found" };

  // Check rider min salary
  const { data: rider } = await supabase
    .from("riders")
    .select("monthly_salary, pcs_rank, ever_in_pool")
    .eq("id", parsed.data.riderId)
    .single();

  if (!rider) return { error: "Rider not found" };
  if (parsed.data.amount < rider.monthly_salary) {
    return { error: `Minimum bid: ${rider.monthly_salary.toLocaleString("fr-FR")} €` };
  }
  if (parsed.data.amount % 100 !== 0) {
    return { error: "Bid must be a multiple of 100 €" };
  }

  // Check if there's already an active bid for this rider/round (to update vs insert)
  const { data: existingBid } = await supabase
    .from("auction_bids")
    .select("id, amount")
    .eq("team_id", team.id)
    .eq("auction_id", parsed.data.auctionId)
    .eq("rider_id", parsed.data.riderId)
    .eq("round", parsed.data.round)
    .eq("status", "active")
    .maybeSingle();

  // Budget check: sum of existing contract salaries + OTHER active bids + this new amount <= treasury
  // NEVER authorize a bid if treasury < total active bids (CLAUDE.md rule)

  // Fetch existing contract salaries
  const { data: existingContracts } = await supabase
    .from("contracts")
    .select("locked_salary")
    .eq("team_id", team.id)
    .in("status", ["active", "notice"]);

  const currentSalaries = (existingContracts ?? []).reduce(
    (s, c) => s + (c.locked_salary || 0),
    0
  );

  const { data: activeBids } = await supabase
    .from("auction_bids")
    .select("id, amount")
    .eq("team_id", team.id)
    .eq("auction_id", parsed.data.auctionId)
    .eq("status", "active");

  const otherBidsTotal = (activeBids ?? [])
    .filter((b) => b.id !== existingBid?.id)
    .reduce((s, b) => s + b.amount, 0);

  if (currentSalaries + otherBidsTotal + parsed.data.amount > team.treasury) {
    return { error: "Insufficient budget" };
  }

  // Level gating: verify rider is accessible at team's level
  if (!rider.ever_in_pool) {
    return { error: "This rider is not in the playable pool" };
  }

  if (rider.pcs_rank && rider.pcs_rank < minRankForLevel(team.level)) {
    return { error: "Insufficient level for this rider" };
  }

  // Co-Unlock Rule (Mech 2): block bid unless ≥2 teams in the league have the required level.
  // Grandfathering is forward-only: existing contracts are untouched.
  const leagueTeamLevels = await fetchLeagueTeamLevels(auction.league_id);
  const coUnlockStatus = computeCoUnlockStatus({
    riderPcsRank: rider.pcs_rank ?? null,
    leagueTeamLevels,
  });
  if (!coUnlockStatus.isUnlocked) {
    const playerWord = coUnlockStatus.playersNeededToUnlock === 1 ? "player reaches" : "players reach";
    return {
      error: `Locked — unlock when ${coUnlockStatus.playersNeededToUnlock} more ${playerWord} Lv.${coUnlockStatus.minLevel}`,
    };
  }

  // Slot overflow check (RC-5): contracts + active bids must not exceed max slots
  if (!existingBid) {
    const maxSlots = getMaxSlots(team.level);
    const { count: contractCount } = await supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team.id)
      .eq("status", "active");
    const bidCount = (activeBids ?? []).length;
    const used = (contractCount ?? 0) + bidCount;
    if (used >= maxSlots) {
      return { error: `No available slots (${used}/${maxSlots} used)` };
    }
  }

  let error;
  if (existingBid) {
    // Update existing active bid
    ({ error } = await supabase
      .from("auction_bids")
      .update({ amount: parsed.data.amount, placed_at: new Date().toISOString() })
      .eq("id", existingBid.id));
  } else {
    // Insert new bid
    ({ error } = await supabase.from("auction_bids").insert({
      auction_id: parsed.data.auctionId,
      rider_id: parsed.data.riderId,
      team_id: team.id,
      amount: parsed.data.amount,
      round: parsed.data.round,
      status: "active",
      placed_at: new Date().toISOString(),
    }));
  }

  if (error) return { error: error.message };

  revalidatePath(`/league`);
  return { success: true };
}

const CancelBidSchema = z.object({
  bidId: z.string().uuid(),
  auctionId: z.string().uuid(),
});

export async function cancelBid(bidId: string, auctionId: string) {
  // Validate UUID
  const parsed = CancelBidSchema.safeParse({ bidId, auctionId });
  if (!parsed.success) return { error: "Invalid data" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify ownership: bid belongs to a team owned by this user
  const { data: bid } = await supabase
    .from("auction_bids")
    .select("id, team_id, auction_id, status, teams!inner(user_id)")
    .eq("id", parsed.data.bidId)
    .single();

  if (!bid) return { error: "Bid not found" };
  if (bid.auction_id !== parsed.data.auctionId) return { error: "Bid does not belong to this auction" };

  const bidTeam = Array.isArray(bid.teams) ? bid.teams[0] : bid.teams;
  if (!bidTeam || bidTeam.user_id !== user.id) return { error: "Not authorized" };
  if (bid.status !== "active") return { error: "Bid is not active" };

  // Check auction is still open (can't cancel after closes_at)
  const { data: auction } = await supabase
    .from("auctions")
    .select("status, closes_at")
    .eq("id", bid.auction_id)
    .single();

  if (!auction || auction.status !== "open") {
    return { error: "Auction is no longer open" };
  }
  if (auction.closes_at && new Date(auction.closes_at) < new Date()) {
    return { error: "Auction bidding period has ended" };
  }

  const { error } = await supabase
    .from("auction_bids")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.bidId);

  if (error) return { error: error.message };

  revalidatePath(`/league`);
  return { success: true };
}
