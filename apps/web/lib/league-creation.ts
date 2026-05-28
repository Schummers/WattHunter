import type { SupabaseClient } from "@supabase/supabase-js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export interface CreateLeagueResult {
  leagueId?: string;
  error?: string;
}

export async function createLeagueWithTeam(
  supabase: SupabaseClient,
  params: {
    userId: string;
    leagueName: string;
    teamName: string;
    startingLevel: number;
    cumulativeXp: number;
  }
): Promise<CreateLeagueResult> {
  // 1. Find unique invite code (5 attempts)
  let inviteCode = generateInviteCode();
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase
      .from("leagues")
      .select("id")
      .eq("invite_code", inviteCode)
      .maybeSingle();
    if (!existing) break;
    inviteCode = generateInviteCode();
  }

  // 2. Insert league
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .insert({
      name: params.leagueName.trim(),
      invite_code: inviteCode,
      commissioner_id: params.userId,
      max_players: 20,
      starting_level: params.startingLevel,
    })
    .select("id")
    .single();
  if (leagueError || !league) {
    return { error: leagueError?.message ?? "League creation failed" };
  }

  // 3. Insert team
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({
      user_id: params.userId,
      league_id: league.id,
      name: params.teamName,
      level: params.startingLevel,
      cumulative_xp: params.cumulativeXp,
    })
    .select("id")
    .single();
  if (teamError || !team) {
    return { error: teamError?.message ?? "Team creation failed" };
  }

  // 4. Auto-assign default sponsor (level-aware, matches legacy createLeague behavior)
  // Level 1 → Lotto (T1), Level 2 → Astana (T2), Level 3+ → no auto-assign (player picks)
  const defaultSlug =
    params.startingLevel <= 1 ? "lotto" : params.startingLevel === 2 ? "astana" : null;
  if (defaultSlug) {
    const { data: defaultSponsor } = await supabase
      .from("sponsors")
      .select("id")
      .eq("slug", defaultSlug)
      .maybeSingle();
    if (defaultSponsor) {
      await supabase.from("team_sponsors").insert({
        team_id: team.id,
        sponsor_id: defaultSponsor.id,
        activated_at: new Date().toISOString(),
      });
    }
  }

  // 5. League member
  const { error: memberError } = await supabase
    .from("league_members")
    .insert({ league_id: league.id, user_id: params.userId, team_id: team.id });
  if (memberError) {
    return { error: memberError.message };
  }

  return { leagueId: league.id };
}
