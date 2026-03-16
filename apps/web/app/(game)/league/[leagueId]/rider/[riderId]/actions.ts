"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentPhase, getNextPhase, isInAuctionWindow, getPhaseRange } from "@/lib/phases";

export async function releaseRider(contractId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Release only allowed during auction window
  const now = new Date();
  if (!isInAuctionWindow(now)) {
    return { error: "Riders can only be released during the auction window." };
  }

  const currentPhase = getCurrentPhase(now);
  const nextPhase = getNextPhase(currentPhase);
  if (!nextPhase) {
    return { error: "Cannot release riders during the last phase of the season." };
  }

  // Verify ownership
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, team_id, status, teams:team_id(user_id)")
    .eq("id", contractId)
    .single();

  if (!contract) return { error: "Contract not found" };

  const team = Array.isArray(contract.teams) ? contract.teams[0] : contract.teams;
  if ((team as { user_id: string })?.user_id !== user.id) {
    return { error: "Not authorized" };
  }

  if (contract.status !== "active") {
    return { error: "Contract is not active" };
  }

  // Release date = start of next phase
  const { start: releaseDate } = getPhaseRange(nextPhase, now.getFullYear());

  const { error } = await supabase
    .from("contracts")
    .update({
      status: "notice",
      notice_date: now.toISOString(),
      release_date: releaseDate.toISOString(),
      effective_phase_id: nextPhase.id,
    })
    .eq("id", contractId);

  if (error) return { error: error.message };

  revalidatePath("/league");
  return { success: true, releasePhaseName: nextPhase.label };
}
