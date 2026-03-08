"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function releaseRider(contractId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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

  const now = new Date();
  const releaseDate = new Date(now);
  releaseDate.setDate(releaseDate.getDate() + 30);

  const { error } = await supabase
    .from("contracts")
    .update({
      status: "notice",
      notice_date: now.toISOString(),
      release_date: releaseDate.toISOString(),
    })
    .eq("id", contractId);

  if (error) return { error: error.message };

  revalidatePath("/league");
  return { success: true };
}
