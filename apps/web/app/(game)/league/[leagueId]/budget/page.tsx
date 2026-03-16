import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AUCTION_PHASES, getCurrentPhase, getPhaseRange } from "@/lib/phases";
import { BudgetClient } from "./budget-client";

export default async function BudgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ phase?: string }>;
}) {
  const { leagueId } = await params;
  const sp = await searchParams;
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

  // Determine phase index
  const currentPhase = getCurrentPhase();
  const defaultIndex = AUCTION_PHASES.findIndex((p) => p.id === currentPhase.id);
  const rawPhase = sp.phase != null ? parseInt(sp.phase, 10) : defaultIndex;
  const phaseIndex = rawPhase >= 0 && rawPhase < AUCTION_PHASES.length ? rawPhase : (defaultIndex >= 0 ? defaultIndex : 0);
  const selectedPhase = AUCTION_PHASES[phaseIndex];

  // Active sponsors with details
  const { data: teamSponsors } = await supabase
    .from("team_sponsors")
    .select("id, slot, status, sponsor_id, sponsors!sponsor_id(id, name, abbreviation, tier, slot, monthly_budget, nationality, nationality_count, specialty, result_condition)")
    .eq("team_id", team.id)
    .eq("status", "active");

  // Transactions for selected phase
  const year = new Date().getFullYear();
  const { start, end } = getPhaseRange(selectedPhase, year);

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
    .select("amount, type")
    .eq("team_id", team.id)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  const totals = phaseTotals ?? [];
  const hasSponsorPayments = totals.some((t) => t.type === "sponsor_payment");

  // Expected sponsor income from active team_sponsors
  let expectedSponsorIncome = 0;
  if (!hasSponsorPayments && teamSponsors && teamSponsors.length > 0) {
    expectedSponsorIncome = teamSponsors.reduce((sum, ts) => {
      const s = Array.isArray(ts.sponsors) ? ts.sponsors[0] : ts.sponsors;
      return sum + ((s as { monthly_budget: number })?.monthly_budget ?? 0);
    }, 0);
  }

  const income = totals
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0) + expectedSponsorIncome;
  const outgoing = totals
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Synthetic sponsor transactions when no real sponsor_payment exists yet
  const realTransactions = transactions ?? [];
  let allTransactions = realTransactions;
  if (!hasSponsorPayments && teamSponsors && teamSponsors.length > 0) {
    const syntheticSponsors = teamSponsors.map((ts) => {
      const s = Array.isArray(ts.sponsors) ? ts.sponsors[0] : ts.sponsors;
      const sponsor = s as { name: string; monthly_budget: number };
      return {
        id: `synthetic-sponsor-${ts.id}`,
        type: "sponsor_payment",
        amount: sponsor?.monthly_budget ?? 0,
        description: `Sponsor — ${sponsor?.name ?? "Unknown"}`,
        created_at: start.toISOString(),
      };
    });
    allTransactions = [...syntheticSponsors, ...realTransactions];
  }

  return (
    <BudgetClient
      leagueId={leagueId}
      treasury={team.treasury}
      level={team.level}
      income={income}
      outgoing={outgoing}
      transactions={allTransactions}
      phaseIndex={phaseIndex}
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
