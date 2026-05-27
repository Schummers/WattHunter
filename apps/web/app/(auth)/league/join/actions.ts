"use server";

import { z } from "zod/v4";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  code: z.string().length(6).regex(/^[A-Z2-9]+$/, "Invalid code."),
  team_name: z.string().min(2, "Team name must be at least 2 characters.").max(30),
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: "Passwords do not match.",
  path: ["confirm_password"],
});

export async function signupAndJoinLeague(
  _prevState: unknown,
  formData: FormData
): Promise<{ error: string } | void> {
  const parsed = schema.safeParse({
    code: (formData.get("code") as string)?.toUpperCase(),
    team_name: formData.get("team_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { code, team_name, email, password } = parsed.data;
  const supabase = await createClient();

  // 1. Sign up
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: team_name } },
  });
  if (signUpError) return { error: signUpError.message };
  if (!signUpData.user) return { error: "Signup failed. Please try again." };

  const userId = signUpData.user.id;

  // 2. Upsert user profile
  const { error: userError } = await supabase.from("users").upsert(
    { id: userId, display_name: team_name, avatar_url: null },
    { onConflict: "id" }
  );
  if (userError) return { error: `User profile error: ${userError.message}` };

  // 3. Join via RPC
  const { data: rpcResult, error: rpcError } = await supabase.rpc("join_league_by_code", {
    p_code: code,
    p_team_name: team_name,
  });

  if (rpcError) return { error: rpcError.message };

  if (rpcResult && typeof rpcResult === "object" && "ok" in rpcResult && !rpcResult.ok) {
    const errMsg = (rpcResult as { error?: string }).error ?? "Unknown error";
    if (errMsg.includes("not found")) return { error: "Invalid code. Check with your Race Director." };
    if (errMsg.includes("full")) return { error: "This league is full." };
    return { error: errMsg };
  }

  const leagueId = (rpcResult as { league_id: string }).league_id;
  redirect(`/league/${leagueId}`);
}
