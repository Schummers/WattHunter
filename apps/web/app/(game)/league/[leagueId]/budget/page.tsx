import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPhase, getPhaseRange } from "@/lib/phases";
import { BudgetClient } from "./budget-client";

export default async function BudgetPage({
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
    .select("id, treasury, level, name")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!team) redirect(`/league/${leagueId}`);

  // Active sponsors with details
  const { data: teamSponsors } = await supabase
    .from("team_sponsors")
    .select("id, slot, status, sponsor_id, sponsors!sponsor_id(id, name, abbreviation, tier, slot, monthly_budget, nationality, nationality_count, specialty, result_condition)")
    .eq("team_id", team.id)
    .eq("status", "active");

  // Transactions for current phase
  const currentPhase = getCurrentPhase();
  const year = new Date().getFullYear();
  const { start, end } = getPhaseRange(currentPhase, year);

  const { data: transactions } = await supabase
    .from("treasury_log")
    .select("*")
    .eq("team_id", team.id)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .order("created_at", { ascending: false })
    .limit(5);

  // Income/outgoing totals
  const { data: phaseTotals } = await supabase
    .from("treasury_log")
    .select("amount")
    .eq("team_id", team.id)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  const income = (phaseTotals ?? [])
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const outgoing = (phaseTotals ?? [])
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <BudgetClient
      leagueId={leagueId}
      treasury={team.treasury}
      level={team.level}
      income={income}
      outgoing={outgoing}
      transactions={transactions ?? []}
      teamSponsors={(teamSponsors ?? []).map((ts) => {
        const s = Array.isArray(ts.sponsors) ? ts.sponsors[0] : ts.sponsors;
        return {
          id: ts.id,
          slot: ts.slot as "secondary" | "principal",
          sponsor: s as {
            id: string;
            name: string;
            abbreviation: string;
            tier: number;
            slot: string;
            monthly_budget: number;
            nationality: string | null;
            nationality_count: number;
            specialty: string[];
            result_condition: string | null;
          },
        };
      })}
    />
  );
}
