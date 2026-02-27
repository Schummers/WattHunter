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

  // Budget check: sum of active bids + this bid <= treasury
  // NEVER authorize a bid if treasury < total active bids (CLAUDE.md rule)
  const { data: activeBids } = await supabase
    .from("auction_bids")
    .select("amount")
    .eq("team_id", team.id)
    .eq("auction_id", parsed.data.auctionId)
    .eq("round", parsed.data.round)
    .eq("status", "active");

  const currentTotal = (activeBids ?? []).reduce((s, b) => s + b.amount, 0);
  if (currentTotal + parsed.data.amount > team.treasury) {
    return { error: "Budget insuffisant" };
  }

  // Upsert bid (insert or update if already exists for this rider/round)
  const { error } = await supabase.from("auction_bids").upsert(
    {
      auction_id: parsed.data.auctionId,
      rider_id: parsed.data.riderId,
      team_id: team.id,
      amount: parsed.data.amount,
      round: parsed.data.round,
      status: "active",
      placed_at: new Date().toISOString(),
    },
    { onConflict: "auction_id,rider_id,team_id,round" }
  );

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
