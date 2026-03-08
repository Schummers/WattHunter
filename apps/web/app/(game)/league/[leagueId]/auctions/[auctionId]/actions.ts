"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { getMaxSlots } from "@/lib/levels";

function minRankForLevel(level: number): number {
  const pools: Record<number, number> = {
    1: 401, 2: 301, 3: 201, 4: 151, 5: 101,
    6: 76, 7: 51, 8: 26, 9: 11, 10: 1,
  };
  return pools[Math.min(Math.max(level, 1), 10)] ?? 401;
}

const BidSchema = z.object({
  auctionId: z.string().uuid(),
  riderId: z.string().uuid(),
  amount: z.number().int().positive(),
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
    .select("league_id")
    .eq("id", parsed.data.auctionId)
    .single();

  if (!auction) return { error: "Auction not found" };

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
    .select("monthly_salary, pcs_rank, ever_in_top500")
    .eq("id", parsed.data.riderId)
    .single();

  if (!rider) return { error: "Rider not found" };
  if (parsed.data.amount < rider.monthly_salary) {
    return { error: `Minimum bid: ${rider.monthly_salary.toLocaleString("fr-FR")} €` };
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

  // Budget check: sum of OTHER active bids + this new amount <= treasury
  // NEVER authorize a bid if treasury < total active bids (CLAUDE.md rule)
  const { data: activeBids } = await supabase
    .from("auction_bids")
    .select("id, amount")
    .eq("team_id", team.id)
    .eq("auction_id", parsed.data.auctionId)
    .eq("round", parsed.data.round)
    .eq("status", "active");

  const otherBidsTotal = (activeBids ?? [])
    .filter((b) => b.id !== existingBid?.id)
    .reduce((s, b) => s + b.amount, 0);

  if (otherBidsTotal + parsed.data.amount > team.treasury) {
    return { error: "Insufficient budget" };
  }

  // Level gating: verify rider is accessible at team's level
  if (!rider.ever_in_top500) {
    return { error: "This rider is not in the playable pool" };
  }

  if (rider.pcs_rank && rider.pcs_rank < minRankForLevel(team.level)) {
    return { error: "Insufficient level for this rider" };
  }

  // Slot overflow check (RC-5): contracts + active bids must not exceed max slots
  if (!existingBid) {
    const maxSlots = getMaxSlots(team.level);
    const { count: contractCount } = await supabase
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team.id)
      .in("status", ["active", "notice"]);
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

export async function cancelBid(bidId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("auction_bids")
    .update({ status: "cancelled" })
    .eq("id", bidId);

  if (error) return { error: error.message };

  revalidatePath(`/league`);
  return { success: true };
}
