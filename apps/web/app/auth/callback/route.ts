import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function ensureUserProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: existingUser } = await supabase
    .from("users")
    .select("id, has_onboarded")
    .eq("id", user.id)
    .single();

  if (!existingUser) {
    await supabase.from("users").insert({
      id: user.id,
      display_name:
        user.user_metadata?.full_name ??
        user.email?.split("@")[0] ??
        "Joueur",
      avatar_url: user.user_metadata?.avatar_url ?? null,
    });
    return { user, hasOnboarded: false };
  }

  return { user, hasOnboarded: existingUser.has_onboarded };
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  // OAuth or email confirmation flow (has code param)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }
  }

  // At this point, session exists (either from code exchange or already logged in via email/password)
  const result = await ensureUserProfile(supabase);

  if (!result) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  if (!result.hasOnboarded) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
