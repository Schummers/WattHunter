"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod/v4";
import { revalidatePath } from "next/cache";

const SaveSponsorsSchema = z.object({
  teamId: z.uuid(),
  leagueId: z.uuid(),
  secondary: z.uuid().nullable(),
  principal: z.uuid().nullable(),
});

export async function saveSponsors(input: z.infer<typeof SaveSponsorsSchema>) {
  const result = SaveSponsorsSchema.safeParse(input);
  if (!result.success) return { error: "Invalid sponsor data" };
  const parsed = result.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: team } = await supabase
    .from("teams")
    .select("id, level")
    .eq("id", parsed.teamId)
    .eq("user_id", user.id)
    .single();

  if (!team) return { error: "Team not found" };

  // Validate secondary sponsor
  if (parsed.secondary) {
    const { data: sponsor } = await supabase
      .from("sponsors")
      .select("unlock_level, slot")
      .eq("id", parsed.secondary)
      .single();
    if (!sponsor || sponsor.slot !== "secondary" || team.level < sponsor.unlock_level) {
      return { error: "Secondary sponsor not available at your level" };
    }
  }

  // Validate principal sponsor
  if (parsed.principal) {
    const { data: sponsor } = await supabase
      .from("sponsors")
      .select("unlock_level, slot")
      .eq("id", parsed.principal)
      .single();
    if (!sponsor || sponsor.slot !== "principal" || team.level < sponsor.unlock_level) {
      return { error: "Main sponsor not available at your level" };
    }
  }

  // Upsert secondary slot
  if (parsed.secondary) {
    const { error: secErr } = await supabase
      .from("team_sponsors")
      .upsert(
        {
          team_id: parsed.teamId,
          sponsor_id: parsed.secondary,
          slot: "secondary",
          status: "active",
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "team_id,slot" },
      );
    if (secErr) return { error: secErr.message };
  }

  // Upsert or remove principal slot
  if (parsed.principal) {
    const { error: priErr } = await supabase
      .from("team_sponsors")
      .upsert(
        {
          team_id: parsed.teamId,
          sponsor_id: parsed.principal,
          slot: "principal",
          status: "active",
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "team_id,slot" },
      );
    if (priErr) return { error: priErr.message };
  } else {
    const { error: delErr } = await supabase
      .from("team_sponsors")
      .delete()
      .eq("team_id", parsed.teamId)
      .eq("slot", "principal");
    if (delErr) return { error: delErr.message };
  }

  revalidatePath(`/league/${parsed.leagueId}/budget`);
  return { success: true };
}
