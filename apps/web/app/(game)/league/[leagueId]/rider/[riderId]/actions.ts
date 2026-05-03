"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentPhase } from "@/lib/phases";

export async function releaseRider(contractId: string) {
  const supabase = await createClient();
  const currentPhase = getCurrentPhase();

  const { data, error } = await supabase.rpc("release_rider", {
    p_contract_id: contractId,
    p_current_phase_id: currentPhase.id,
  });

  if (error) return { error: error.message };

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) return { error: result?.error ?? "Release failed" };

  revalidatePath("/league");
  return { success: true };
}
