"use server";

import { cookies } from "next/headers";

export type SignupIntent =
  | { kind: "create"; league_name: string; team_name: string }
  | { kind: "join"; code: string; team_name: string };

export async function setSignupIntentCookie(intent: SignupIntent): Promise<void> {
  const c = await cookies();
  c.set("signup_intent", JSON.stringify(intent), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
}
