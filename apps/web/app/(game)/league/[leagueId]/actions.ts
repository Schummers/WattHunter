"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";

const LaunchSchema = z.object({
  leagueId: z.uuid(),
});

export async function launchFirstAuction(leagueId: string) {
  const parsed = LaunchSchema.safeParse({ leagueId });
  if (!parsed.success) {
    return { error: "Invalid league id." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("launch_first_auction", {
    p_league_id: parsed.data.leagueId,
  });

  if (error) {
    return { error: "Failed to launch the auction." };
  }

  const payload = data as { ok: boolean; error?: string } | null;
  if (!payload?.ok) {
    switch (payload?.error) {
      case "unauthenticated":
        return { error: "Not authenticated." };
      case "not_commissioner":
        return { error: "Only the Race Director can launch the first auction." };
      case "already_started":
        return { error: "The league has already started." };
      case "league_not_found":
        return { error: "League not found." };
      default:
        return { error: "Failed to launch the auction." };
    }
  }

  revalidatePath(`/league/${parsed.data.leagueId}`);
  redirect(`/league/${parsed.data.leagueId}`);
}
