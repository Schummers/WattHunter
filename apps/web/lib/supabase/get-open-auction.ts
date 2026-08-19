import { SupabaseClient } from "@supabase/supabase-js";

interface OpenDueAuctionResult {
  ok?: boolean;
  id?: string | null;
  name?: string | null;
  opened?: boolean;
  error?: string;
}

/**
 * Returns the league's open auction round, opening a due 'scheduled' one if needed.
 *
 * The flip lives in the `open_due_auction` RPC (SECURITY DEFINER) rather than here:
 * doing it from the client meant an UPDATE on `auctions` under RLS, and the only
 * UPDATE policy is commissioner-only, so it silently failed for every other player.
 */
export async function getOpenAuction(
  supabase: SupabaseClient,
  leagueId: string
): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase.rpc("open_due_auction", {
    p_league_id: leagueId,
  });

  if (error) return null;

  const result = data as OpenDueAuctionResult | null;
  if (!result?.ok || !result.id) return null;

  return { id: result.id, name: result.name ?? "" };
}
