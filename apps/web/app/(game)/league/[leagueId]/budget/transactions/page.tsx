import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TransactionsClient } from "./transactions-client";

export default async function AllTransactionsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
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
    .select("*")
    .eq("team_id", team.id)
    .order("created_at", { ascending: false });

  return <TransactionsClient transactions={transactions ?? []} />;
}
