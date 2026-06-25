import type { SupabaseClient } from "@supabase/supabase-js";
import { getLevelByNumber } from "@/lib/levels";
import { classicTeamDefaults } from "@/lib/league-mode";

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
    mode?: "manager" | "classic";
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
      mode: params.mode ?? "manager",
    })
    .select("id")
    .single();
  if (leagueError || !league) {
    return { error: leagueError?.message ?? "League creation failed" };
  }

  // 3. Insert team (classic vs manager defaults diverge here)
  const isClassicMode = params.mode === "classic";
  const classicDefaults = isClassicMode ? classicTeamDefaults() : null;

  const teamLevel = isClassicMode ? classicDefaults!.starting_level : params.startingLevel;
  const teamXp = isClassicMode ? getLevelByNumber(classicDefaults!.starting_level).xp : params.cumulativeXp;
  const teamTreasury = isClassicMode ? classicDefaults!.treasury : undefined;
  const teamUnderdogEligible = isClassicMode ? classicDefaults!.underdog_eligible : undefined;

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({
      user_id: params.userId,
      league_id: league.id,
      name: params.teamName,
      level: teamLevel,
      cumulative_xp: teamXp,
      ...(teamTreasury !== undefined && { treasury: teamTreasury }),
      ...(teamUnderdogEligible !== undefined && { underdog_eligible: teamUnderdogEligible }),
    })
    .select("id")
    .single();
  if (teamError || !team) {
    return { error: teamError?.message ?? "Team creation failed" };
  }

  // 4. Auto-assign default sponsor (manager mode only)
  // Classic mode skips sponsor assignment entirely.
  // Manager: Level 1 → Lotto (T1), Level 2 → Astana (T2), Level 3+ → no auto-assign (player picks)
  if (!isClassicMode) {
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
