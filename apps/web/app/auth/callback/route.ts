import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readSignupIntentCookie, clearSignupIntentCookie } from "./oauth-intent";
import { createLeagueWithTeam } from "@/lib/league-creation";
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
    .maybeSingle();

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
      // Combined signup always starts a fresh league at level 1.
      // Use the legacy createLeague action for level-customizable creation.
      const startingLevel = 1;
      const levelData = getLevelByNumber(startingLevel);

      const result = await createLeagueWithTeam(supabase, {
        userId: user.id,
        leagueName: intent.league_name,
        teamName: intent.team_name,
        startingLevel,
        cumulativeXp: levelData.xp,
      });

      if (result.error || !result.leagueId) {
        const response = NextResponse.redirect(`${origin}/league/create?error=create_failed`);
        for (const { name, value, options } of pendingCookies) {
          response.cookies.set(name, value, options);
        }
        return response;
      }

      const response = NextResponse.redirect(`${origin}/league/${result.leagueId}`);
      for (const { name, value, options } of pendingCookies) {
        response.cookies.set(name, value, options);
      }
      return response;
    } else if (intent.kind === "join") {
      const { data: rpcResult } = await supabase.rpc("join_league_by_code", {
        p_code: intent.code,
        p_team_name: intent.team_name,
      });
      const r = rpcResult as {
        ok?: boolean;
        error?: string;
        league_id?: string;
        already_member?: boolean;
        late_join?: boolean;
        starting_level?: number;
        team_id?: string;
      } | null;

      if (r?.ok && r.league_id) {
        // Auto-assign default sponsor for new (non-late, non-returning) joiners
        if (!r.already_member && !r.late_join && r.team_id) {
          const startLevel = r.starting_level ?? 1;
          const defaultSlug =
            startLevel <= 1 ? "lotto" : startLevel === 2 ? "astana" : null;
          if (defaultSlug) {
            const { data: defaultSponsor } = await supabase
              .from("sponsors")
              .select("id")
              .eq("slug", defaultSlug)
              .maybeSingle();
            if (defaultSponsor) {
              await supabase.from("team_sponsors").insert({
                team_id: r.team_id,
                sponsor_id: defaultSponsor.id,
                activated_at: new Date().toISOString(),
              });
            }
          }
        }

        const response = NextResponse.redirect(`${origin}/league/${r.league_id}`);
        for (const { name, value, options } of pendingCookies) {
          response.cookies.set(name, value, options);
        }
        return response;
      }

      // Join failed — redirect back with a descriptive error slug
      const errMsg = r?.error ?? "";
      const errorSlug = errMsg.includes("not found")
        ? "not_found"
        : errMsg.includes("full")
          ? "full"
          : errMsg.includes("ended")
            ? "ended"
            : "unknown";
      const joinErrorUrl = new URL(`${origin}/league/join`);
      joinErrorUrl.searchParams.set("error", errorSlug);
      joinErrorUrl.searchParams.set("code", intent.code);
      joinErrorUrl.searchParams.set("team_name", intent.team_name);
      const response = NextResponse.redirect(joinErrorUrl.toString());
      for (const { name, value, options } of pendingCookies) {
        response.cookies.set(name, value, options);
      }
      return response;
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

  // Validate next parameter to prevent open redirect.
  // Prefix checks alone are bypassable (e.g. "/\evil.com" normalizes to "//evil.com"
  // in browsers), so resolve against origin and require the result to stay same-origin.
  let isValidNext = false;
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    try {
      isValidNext = new URL(next, origin).origin === origin;
    } catch {
      isValidNext = false;
    }
  }

  if (isValidNext) {
    redirectTo = `${origin}${next}`;
  } else {
    const { data: membership } = await supabase
      .from("league_members")
      .select("league_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

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
