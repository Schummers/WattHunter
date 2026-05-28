"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";
import { getLevelByNumber } from "@/lib/levels";
import { generateInviteCode, createLeagueWithTeam } from "@/lib/league-creation";

// ---------------------------------------------------------------------------
// createLeague — for already-authenticated users
// ---------------------------------------------------------------------------

const createLeagueSchema = z.object({
  name: z.string().min(2, "League name must be at least 2 characters.").max(50),
  starting_level: z.coerce.number().int().min(1).max(8).default(1),
});

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
      starting_level,
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

// ---------------------------------------------------------------------------
// signupAndCreateLeague — combined sign-up + league creation for new users
// Combined signup always starts a fresh league at level 1.
// Use the legacy createLeague for level-customizable creation.
// ---------------------------------------------------------------------------

const signupAndCreateLeagueSchema = z
  .object({
    league_name: z
      .string()
      .min(2, "League name must be at least 2 characters.")
      .max(50),
    team_name: z
      .string()
      .min(2, "Team name must be at least 2 characters.")
      .max(30),
    email: z.email("Invalid email address."),
    password: z.string().min(6, "Password must be at least 6 characters."),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });

export async function signupAndCreateLeague(
  _prevState: unknown,
  formData: FormData
): Promise<{ error: string } | void> {
  const parsed = signupAndCreateLeagueSchema.safeParse({
    league_name: formData.get("league_name"),
    team_name: formData.get("team_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { league_name, team_name, email, password } = parsed.data;
  const supabase = await createClient();

  // 1. Sign up the user
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: team_name },
    },
  });

  if (signUpError) {
    return { error: signUpError.message };
  }
  if (!signUpData.user) {
    return { error: "Signup failed. Please try again." };
  }

  const userId = signUpData.user.id;

  // 2. Upsert public.users row (FK constraint for leagues.commissioner_id)
  const { error: userError } = await supabase
    .from("users")
    .upsert(
      { id: userId, display_name: team_name, avatar_url: null },
      { onConflict: "id" }
    );
  if (userError) {
    return { error: `User profile error: ${userError.message}` };
  }

  // 3. Create league + team + sponsor + member via shared helper
  const startingLevel = 1;
  const levelData = getLevelByNumber(startingLevel);

  const result = await createLeagueWithTeam(supabase, {
    userId,
    leagueName: league_name,
    teamName: team_name,
    startingLevel,
    cumulativeXp: levelData.xp,
  });

  if (result.error || !result.leagueId) {
    console.error("League creation failed:", result.error);
    return { error: result.error ?? "Failed to create league." };
  }

  redirect(`/league/${result.leagueId}`);
}
