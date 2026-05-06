"use server";

import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";

const joinLeagueSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be exactly 6 characters.")
    .regex(/^[A-Z2-9]+$/, "Invalid code."),
});

export async function joinLeague(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const raw = (formData.get("code") as string)?.toUpperCase().trim();

  const parsed = joinLeagueSchema.safeParse({ code: raw });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { code } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  // Ensure public.users row exists before the RPC runs
  const displayName =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Player";
  await supabase
    .from("users")
    .upsert(
      { id: user.id, display_name: displayName, avatar_url: user.user_metadata?.avatar_url ?? null },
      { onConflict: "id" }
    );

  // Atomic lookup + join via SECURITY DEFINER RPC (invite_code never exposed to client)
  const { data: result, error: rpcError } = await supabase.rpc(
    "join_league_by_code",
    { p_code: code }
  );

  if (rpcError) {
    console.error("join_league_by_code RPC error:", rpcError);
    return { error: "Failed to join league." };
  }

  const rpcResult = result as {
    ok?: boolean;
    error?: string;
    already_member?: boolean;
    late_join?: boolean;
    can_join_current_phase?: boolean;
    league_id?: string;
    team_id?: string;
    starting_level?: number;
  };

  if (rpcResult.error) {
    // Map RPC error strings to user-facing messages
    switch (rpcResult.error) {
      case "League not found":
        return { error: "Invalid code. Check with your Race Director." };
      case "League is full":
        return { error: "This league is full." };
      case "Already a member of this league":
        // Handled below via already_member flag; should not reach here
        break;
      default:
        return { error: rpcResult.error };
    }
  }

  if (!rpcResult.ok || !rpcResult.league_id || !rpcResult.team_id) {
    return { error: "Failed to join league." };
  }

  const leagueId = rpcResult.league_id;
  const teamId = rpcResult.team_id;
  const startLevel = rpcResult.starting_level ?? 1;

  // If already a member, skip sponsor assignment and redirect directly
  if (!rpcResult.already_member && !rpcResult.late_join) {
    // Auto-assign default sponsor based on starting level (mirrors createLeague logic)
    const defaultSlug = startLevel <= 1 ? "lotto" : startLevel === 2 ? "astana" : null;
    if (defaultSlug) {
      const { data: defaultSponsor } = await supabase
        .from("sponsors")
        .select("id")
        .eq("slug", defaultSlug)
        .single();

      if (defaultSponsor) {
        await supabase
          .from("team_sponsors")
          .insert({ team_id: teamId, sponsor_id: defaultSponsor.id, activated_at: new Date().toISOString() });
      }
    }
  }

  redirect(`/league/${leagueId}`);
}
