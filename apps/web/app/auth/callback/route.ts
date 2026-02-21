import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
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
          return NextResponse.redirect(`${origin}/onboarding`);
        }

        if (!existingUser.has_onboarded) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }

        const forwardedHost = request.headers.get("x-forwarded-host");
        const isLocalEnv = process.env.NODE_ENV === "development";
        if (isLocalEnv) {
          return NextResponse.redirect(`${origin}${next}`);
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`);
        } else {
          return NextResponse.redirect(`${origin}${next}`);
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
