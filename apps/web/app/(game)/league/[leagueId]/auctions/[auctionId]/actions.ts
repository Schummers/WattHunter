"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const BidSchema = z.object({
  auctionId: z.string().uuid(),
  riderId: z.string().uuid(),
  amount: z.number().int().positive().multipleOf(100),
  round: z.number().int().min(1).max(3),
});

export async function placeBid(input: z.infer<typeof BidSchema>) {
  const parsed = BidSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Donnees invalides" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifie" };

  const { data: team } = await supabase
    .from("teams")
    .select("id, treasury")
    .eq("user_id", user.id)
    .single();

  if (!team) return { error: "Equipe introuvable" };

  // Check rider min salary
  const { data: rider } = await supabase
    .from("riders")
    .select("monthly_salary")
    .eq("id", parsed.data.riderId)
    .single();

  if (!rider) return { error: "Coureur introuvable" };
  if (parsed.data.amount < rider.monthly_salary) {
    return { error: `Mise minimum: ${rider.monthly_salary} EUR` };
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
    return { error: "Budget insuffisant" };
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
