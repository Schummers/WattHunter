"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";

const SetLevelSchema = z.object({
  leagueId: z.uuid(),
  level: z.number().int().min(1).max(8),
});

export async function setStartingLevel(leagueId: string, level: number) {
  const parsed = SetLevelSchema.safeParse({ leagueId, level });
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid request." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_starting_level", {
    p_league_id: parsed.data.leagueId,
    p_level: parsed.data.level,
  });

  if (error) {
    return { ok: false as const, error: "Failed to update level." };
  }

  const payload = data as { ok: boolean; error?: string } | null;
  if (!payload?.ok) {
    switch (payload?.error) {
      case "unauthenticated":
        return { ok: false as const, error: "Not authenticated." };
      case "not_commissioner":
        return { ok: false as const, error: "Only the Race Director can change the level." };
      case "already_started":
        return { ok: false as const, error: "The league has already started." };
      case "invalid_level":
        return { ok: false as const, error: "Pick a level between 1 and 8." };
      case "league_not_found":
        return { ok: false as const, error: "League not found." };
      default:
        return { ok: false as const, error: "Failed to update level." };
    }
  }

  revalidatePath(`/lobby/${parsed.data.leagueId}`);
  return { ok: true as const };
}
