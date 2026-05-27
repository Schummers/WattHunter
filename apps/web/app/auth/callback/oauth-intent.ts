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

export async function readSignupIntentCookie(): Promise<SignupIntent | null> {
  const c = await cookies();
  const raw = c.get("signup_intent")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.kind === "create" || parsed?.kind === "join") {
      return parsed as SignupIntent;
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearSignupIntentCookie(): Promise<void> {
  const c = await cookies();
  c.delete("signup_intent");
}
