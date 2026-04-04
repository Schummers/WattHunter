"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getLevelByNumber } from "@/lib/levels";

const joinLeagueSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be exactly 6 characters.")
    .regex(/^[A-Z2-9]+$/, "Invalid code."),
});

export async function joinLeague(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = (formData.get("code") as string)?.toUpperCase().trim();

  const parsed = joinLeagueSchema.safeParse({ code: raw });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { code } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, status, max_players, starting_level")
    .eq("invite_code", code)
    .single();

  if (!league) {
    return { error: "Invalid code. Check with your Race Director." };
  }

  if (league.status === "active") {
    return { error: "This league has already started. You can't join anymore." };
  }

  const { data: existingMember } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .single();

  if (existingMember) {
    redirect(`/league/${league.id}`);
  }

  const { count } = await supabase
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("league_id", league.id);

  if (count !== null && count >= league.max_players) {
    return { error: "This league is full." };
  }

  // Ensure public.users row exists
  const displayName =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Player";
  await supabase
    .from("users")
    .upsert(
      { id: user.id, display_name: displayName, avatar_url: user.user_metadata?.avatar_url ?? null },
      { onConflict: "id" }
    );

  const startLevel = league.starting_level ?? 1;
  const levelData = getLevelByNumber(startLevel);

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({
      user_id: user.id,
      league_id: league.id,
      name: displayName,
      level: startLevel,
      cumulative_xp: levelData.xp,
    })
    .select("id")
    .single();

  if (teamError || !team) {
    console.error("Team creation failed:", teamError);
    return { error: "Failed to create team." };
  }

  // Auto-assign default sponsor based on starting level (mirrors createLeague logic)
  const defaultSlug = startLevel <= 1 ? "lotto" : startLevel === 2 ? "astana" : null;
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

  const { error: joinError } = await supabase.from("league_members").insert({
    league_id: league.id,
    user_id: user.id,
    team_id: team.id,
  });

  if (joinError) {
    return { error: "Failed to join league." };
  }

  redirect(`/league/${league.id}`);
}
