import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TransactionsClient } from "./transactions-client";
import {
  DEMO_LEAGUE_SLUG,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

export default async function AllTransactionsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoTeamTransactions();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!team) redirect(`/league/${leagueId}`);

  const { data: transactions } = await supabase
    .from("treasury_log")
    .select("*, riders:rider_id(photo_url, full_name)")
    .eq("team_id", team.id)
    .order("created_at", { ascending: false });

  // Flatten rider join data for client component
  const mappedTransactions = (transactions ?? []).map((t: Record<string, unknown>) => {
    const rider = t.riders as { photo_url: string | null; full_name: string } | null;
    return {
      id: t.id as string,
      type: t.type as string,
      amount: t.amount as number,
      description: t.description as string | null,
      created_at: t.created_at as string,
      rider_photo_url: rider?.photo_url ?? null,
      rider_name: rider?.full_name ?? null,
    };
  });

  return <TransactionsClient transactions={mappedTransactions} />;
}

// ---------------------------------------------------------------------------
// Demo path — anonymous visitor, no auth required
// ---------------------------------------------------------------------------
async function renderDemoTeamTransactions() {
  const supabase = await createClient();
  const teamId = DEMO_VISITOR_TEAM_ID;

  const { data: transactions } = await supabase
    .from("treasury_log")
    .select("*, riders:rider_id(photo_url, full_name)")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  const mappedTransactions = (transactions ?? []).map((t: Record<string, unknown>) => {
    const rider = t.riders as { photo_url: string | null; full_name: string } | null;
    return {
      id: t.id as string,
      type: t.type as string,
      amount: t.amount as number,
      description: t.description as string | null,
      created_at: t.created_at as string,
      rider_photo_url: rider?.photo_url ?? null,
      rider_name: rider?.full_name ?? null,
    };
  });

  return <TransactionsClient transactions={mappedTransactions} />;
}
