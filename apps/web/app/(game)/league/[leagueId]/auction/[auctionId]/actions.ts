"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const BidSchema = z.object({
  auctionId: z.string().uuid(),
  riderId: z.string().uuid(),
  amount: z.number().int().positive().max(100_000_000),
  round: z.number().int().min(1).max(8),
});

export async function placeBid(input: z.infer<typeof BidSchema>) {
  const parsed = BidSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid data" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_bid", {
    p_auction_id: parsed.data.auctionId,
    p_rider_id: parsed.data.riderId,
    p_amount: parsed.data.amount,
    p_round: parsed.data.round,
  });

  if (error) return { error: error.message };

  const result = data as { ok?: boolean; error?: string; bid_id?: string } | null;
  if (!result?.ok) return { error: result?.error ?? "Bid failed" };

  revalidatePath("/league");
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

  // Check auction is still open
  const { data: auction } = await supabase
    .from("auctions")
    .select("status")
    .eq("id", bid.auction_id)
    .single();

  if (!auction || auction.status !== "open") {
    return { error: "Auction is no longer open" };
  }

  const { error } = await supabase
    .from("auction_bids")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.bidId);

  if (error) return { error: error.message };

  revalidatePath(`/league`);
  return { success: true };
}
