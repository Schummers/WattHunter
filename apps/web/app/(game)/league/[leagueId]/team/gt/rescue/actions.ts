"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod/v4"

const PlaceEmergencyBidSchema = z.object({
  riderId: z.uuid(),
  amount: z.number().int().min(5000),
  phaseId: z.number().int(),
  gtIdentifier: z.string().min(1),
  gtYear: z.number().int(),
  leagueId: z.uuid(),
})

export async function placeEmergencyBid(
  input: z.infer<typeof PlaceEmergencyBidSchema>
) {
  const parsed = PlaceEmergencyBidSchema.safeParse(input)
  if (!parsed.success) return { error: "Invalid input" }

  const { riderId, amount, phaseId, gtIdentifier, gtYear, leagueId } = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("gt_place_emergency_bid", {
    p_rider_id: riderId,
    p_amount: amount,
    p_phase_id: phaseId,
    p_gt_identifier: gtIdentifier,
    p_gt_year: gtYear,
    p_league_id: leagueId,
  })

  if (error) return { error: error.message }

  revalidatePath(`/league/${leagueId}`)
  return data as { ok: boolean }
}
