import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { AUCTION_PHASES, getCurrentPhase, getPhaseRange } from "@/lib/phases";
import { BudgetClient } from "./budget-client";
import type { SponsorRow } from "@/lib/sponsors";

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

  const user = await getUser();
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

  const year = new Date().getFullYear();
  const { start, end } = getPhaseRange(selectedPhase, year);

  // Fetch sponsor, transactions, totals, and active contracts in parallel
  const [
    { data: teamSponsor },
    { data: transactions },
    { data: phaseTotals },
    { data: activeContracts },
  ] = await Promise.all([
    // Simple single-sponsor query — new schema has no slot/status/pending fields
    supabase
      .from("team_sponsors")
      .select("id, sponsor_id, activated_at, sponsors(*)")
      .eq("team_id", team.id)
      .maybeSingle(),
    supabase
      .from("treasury_log")
      .select("*, riders:rider_id(photo_url, full_name)")
      .eq("team_id", team.id)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("treasury_log")
      .select("amount, type")
      .eq("team_id", team.id)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString()),
    // Phase salary total: sum of locked salaries on active contracts
    supabase
      .from("contracts")
      .select("locked_salary")
      .eq("team_id", team.id)
      .eq("status", "active"),
  ]);

  const totals = phaseTotals ?? [];

  // Phase income from treasury_log (actual sponsor payments logged by finance job)
  const income = totals
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const outgoing = totals
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Phase salary summary: sum of all active contract locked_salary values
  const phaseSalaries = (activeContracts ?? []).reduce(
    (sum, c) => sum + (c.locked_salary ?? 0),
    0,
  );

  // Sponsor info for display — pass full SponsorRow for expanded card
  const sponsorRow = teamSponsor?.sponsors
    ? (Array.isArray(teamSponsor.sponsors) ? teamSponsor.sponsors[0] : teamSponsor.sponsors)
    : null;

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

  return (
    <BudgetClient
      leagueId={leagueId}
      treasury={team.treasury}
      level={team.level}
      income={income}
      outgoing={outgoing}
      transactions={mappedTransactions}
      phaseIndex={phaseIndex}
      currentSponsor={sponsorRow as SponsorRow | null}
      phaseSalaries={phaseSalaries}
    />
  );
}
