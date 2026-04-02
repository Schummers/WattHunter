"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLevelByNumber } from "@/lib/levels";

const createLeagueSchema = z.object({
  name: z.string().min(2, "League name must be at least 2 characters.").max(50),
  starting_level: z.coerce.number().int().min(1).max(8).default(1),
});

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createLeague(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const parsed = createLeagueSchema.safeParse({
    name: formData.get("name"),
    starting_level: formData.get("starting_level"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { name, starting_level } = parsed.data;
  const levelData = getLevelByNumber(starting_level);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  // Ensure public.users row exists BEFORE league insert (FK constraint)
  const displayName =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Player";
  await supabase
    .from("users")
    .upsert(
      { id: user.id, display_name: displayName, avatar_url: user.user_metadata?.avatar_url ?? null },
      { onConflict: "id" }
    );

  let inviteCode = generateInviteCode();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from("leagues")
      .select("id")
      .eq("invite_code", inviteCode)
      .single();
    if (!existing) break;
    inviteCode = generateInviteCode();
    attempts++;
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .insert({
      name: name.trim(),
      invite_code: inviteCode,
      commissioner_id: user.id,
      max_players: 20,
    })
    .select("id")
    .single();

  if (leagueError || !league) {
    console.error("League creation failed:", leagueError);
    return { error: `Failed to create league: ${leagueError?.message ?? "unknown"}` };
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({
      user_id: user.id,
      league_id: league.id,
      name: displayName,
      level: starting_level,
      cumulative_xp: levelData.xp,
    })
    .select("id")
    .single();

  if (teamError || !team) {
    console.error("Team creation failed:", teamError);
    return { error: "Failed to create team." };
  }

  // Auto-assign default sponsor based on starting level (single sponsor per team)
  // Level 1 → Lotto (T1), Level 2 → Astana (T2), Level 3+ → no auto-assign (player picks)
  const defaultSlug = starting_level <= 1 ? "lotto" : starting_level === 2 ? "astana" : null;
  if (defaultSlug) {
    const { data: defaultSponsor } = await supabase
      .from("sponsors")
      .select("id")
      .eq("slug", defaultSlug)
      .single();

    if (defaultSponsor) {
      await supabase
        .from("team_sponsors")
        .insert({ team_id: team.id, sponsor_id: defaultSponsor.id, activated_at: new Date().toISOString() });
    }
  }

  const { error: memberError } = await supabase.from("league_members").insert({
    league_id: league.id,
    user_id: user.id,
    team_id: team.id,
  });

  if (memberError) {
    return { error: "Failed to join league." };
  }

  redirect(`/league/${league.id}`);
}
