import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readSignupIntentCookie, clearSignupIntentCookie } from "./oauth-intent";
import { generateInviteCode } from "@/lib/league-creation";
import { getLevelByNumber } from "@/lib/levels";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const type = searchParams.get("type");

  const cookieStore = await cookies();

  // Track cookies that Supabase sets during exchangeCodeForSession
  const pendingCookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            pendingCookies.push({ name, value, options });
          });
        },
      },
    },
  );

  // OAuth or email confirmation flow (has code param)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Ensure user profile exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!existingUser) {
    await supabase.from("users").insert({
      id: user.id,
      display_name:
        user.user_metadata?.full_name ??
        user.email?.split("@")[0] ??
        "Player",
      avatar_url: user.user_metadata?.avatar_url ?? null,
    });
  }

  // Handle signup intent cookie (create/join league after OAuth)
  const intent = await readSignupIntentCookie();
  if (intent) {
    await clearSignupIntentCookie();

    if (intent.kind === "create") {
      // Find a unique invite code (5 attempts)
      let inviteCode = generateInviteCode();
      for (let i = 0; i < 5; i++) {
        const { data: existing } = await supabase
          .from("leagues")
          .select("id")
          .eq("invite_code", inviteCode)
          .single();
        if (!existing) break;
        inviteCode = generateInviteCode();
      }

      const startingLevel = 1;
      const levelData = getLevelByNumber(startingLevel);

      const { data: league, error: leagueError } = await supabase
        .from("leagues")
        .insert({
          name: intent.league_name.trim(),
          invite_code: inviteCode,
          commissioner_id: user.id,
          max_players: 20,
          starting_level: startingLevel,
        })
        .select("id")
        .single();

      if (!leagueError && league) {
        const { data: team } = await supabase
          .from("teams")
          .insert({
            user_id: user.id,
            league_id: league.id,
            name: intent.team_name,
            level: startingLevel,
            cumulative_xp: levelData.xp,
          })
          .select("id")
          .single();

        if (team) {
          // Default sponsor — Lotto for level 1
          const { data: lotto } = await supabase
            .from("sponsors")
            .select("id")
            .eq("slug", "lotto")
            .single();
          if (lotto) {
            await supabase.from("team_sponsors").insert({
              team_id: team.id,
              sponsor_id: lotto.id,
              activated_at: new Date().toISOString(),
            });
          }

          await supabase.from("league_members").insert({
            league_id: league.id,
            user_id: user.id,
            team_id: team.id,
          });

          const response = NextResponse.redirect(`${origin}/league/${league.id}`);
          for (const { name, value, options } of pendingCookies) {
            response.cookies.set(name, value, options);
          }
          return response;
        }
      }
      // If create failed, fall through to default redirect (chooser)
    } else if (intent.kind === "join") {
      const { data: rpcResult } = await supabase.rpc("join_league_by_code", {
        p_code: intent.code,
        p_team_name: intent.team_name,
      });
      const r = rpcResult as { ok?: boolean; league_id?: string } | null;
      if (r?.ok && r.league_id) {
        const response = NextResponse.redirect(`${origin}/league/${r.league_id}`);
        for (const { name, value, options } of pendingCookies) {
          response.cookies.set(name, value, options);
        }
        return response;
      }
      // If join failed, fall through to default redirect (chooser)
    }
  }

  // Recovery flow: redirect to reset-password page
  if (type === "recovery") {
    const response = NextResponse.redirect(`${origin}/reset-password`);
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options);
    }
    return response;
  }

  // Determine redirect destination
  let redirectTo = `${origin}/league/choose`;

  // Validate next parameter to prevent open redirect
  const isValidNext = next && next.startsWith("/") && !next.startsWith("//") && !next.includes(":");

  if (isValidNext) {
    redirectTo = `${origin}${next}`;
  } else {
    const { data: membership } = await supabase
      .from("league_members")
      .select("league_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (membership) {
      redirectTo = `${origin}/league/${membership.league_id}`;
    }
  }

  // Create redirect response and explicitly set all auth cookies on it
  const response = NextResponse.redirect(redirectTo);
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }

  return response;
}
