"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentPhase } from "@/lib/phases";
import { z } from "zod/v4";

const ReleaseSchema = z.object({
  contractId: z.uuid(),
});

export async function releaseRider(contractId: string) {
  const parsed = ReleaseSchema.safeParse({ contractId });
  if (!parsed.success) return { error: "Invalid data" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
