import { SupabaseClient } from "@supabase/supabase-js";

export async function getOpenAuction(
  supabase: SupabaseClient,
  leagueId: string
): Promise<{ id: string; name: string } | null> {
  // 1. Check for already-open round
  const { data: openRound } = await supabase
    .from("auctions")
    .select("id, name")
    .eq("league_id", leagueId)
    .eq("status", "open")
    .maybeSingle();

  if (openRound) return openRound;

  // 2. Check for a scheduled round whose opens_at is in the past (lazy-open)
  const { data: dueRound } = await supabase
    .from("auctions")
    .select("id, name")
    .eq("league_id", leagueId)
    .eq("status", "scheduled")
    .lte("opens_at", new Date().toISOString())
    .order("opens_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!dueRound) return null;

  // 3. Open it
  await supabase
    .from("auctions")
    .update({ status: "open" })
    .eq("id", dueRound.id);

  return dueRound;
}
