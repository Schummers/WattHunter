import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

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
