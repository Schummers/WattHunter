import { createClient } from "@/lib/supabase/server";
import { getCurrentPhase } from "@/lib/phases";
import { formatEuro } from "@/lib/format";
import { Tag } from "@/components/pill";
import { StatusClient } from "./status-client";

interface TeamRow {
  team_id: string;
  team_name: string;
  budget: number;
  status: "validated" | "pending" | "not_yet_bid";
}

export default async function StatusPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="px-4 py-8">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          Please sign in to view this page.
        </p>
      </div>
    );
  }

  const phase = getCurrentPhase();

  // 1. Open auction (may be null)
  const { data: auction } = await supabase
    .from("auctions")
    .select("id, name, opens_at, league_id")
    .eq("league_id", leagueId)
    .eq("status", "open")
    .order("opens_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // 2. All teams in the league
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, treasury, level, phase_confirmed_id")
    .eq("league_id", leagueId)
    .order("name", { ascending: true });

  const teamList = teams ?? [];
  const teamIds = teamList.map((t) => t.id);

  // 3. round_validations for this auction (if any)
  const validatedTeamIds = new Set<string>();
  if (auction && teamIds.length > 0) {
    const { data: validations } = await supabase
      .from("round_validations")
      .select("team_id")
      .eq("auction_id", auction.id)
      .in("team_id", teamIds);
    for (const v of validations ?? []) {
      validatedTeamIds.add(v.team_id);
    }
  }

  // 4. draft_bids count per team (to distinguish "pending" vs "not_yet_bid")
  const draftCount = new Map<string, number>();
  if (teamIds.length > 0) {
    const { data: drafts } = await supabase
      .from("draft_bids")
      .select("team_id")
      .eq("league_id", leagueId)
      .in("team_id", teamIds);
    for (const d of drafts ?? []) {
      draftCount.set(d.team_id, (draftCount.get(d.team_id) ?? 0) + 1);
    }
  }

  // 5. Active contract salaries per team (for purchasing power)
  const activeSalaries = new Map<string, number>();
  if (teamIds.length > 0) {
    const { data: contracts } = await supabase
      .from("contracts")
      .select("team_id, locked_salary")
      .in("team_id", teamIds)
      .eq("status", "active");
    for (const c of contracts ?? []) {
      activeSalaries.set(
        c.team_id,
        (activeSalaries.get(c.team_id) ?? 0) + (c.locked_salary ?? 0)
      );
    }
  }

  // 6. Sponsor income per team
  const sponsorIncome = new Map<string, number>();
  if (teamIds.length > 0) {
    const { data: tsRows } = await supabase
      .from("team_sponsors")
      .select("team_id, sponsors:sponsor_id(monthly_budget)")
      .in("team_id", teamIds);
    for (const ts of tsRows ?? []) {
      const sponsor = Array.isArray(ts.sponsors) ? ts.sponsors[0] : ts.sponsors;
      const budget =
        (sponsor as { monthly_budget?: number } | null)?.monthly_budget ?? 0;
      sponsorIncome.set(ts.team_id, budget);
    }
  }

  // 7. Build the rows
  //    Budget = treasury + sponsor income (post-payday: sponsor already credited
  //    into treasury; pre-payday: project the upcoming sponsor income).
  //    Salaries are NOT subtracted here — purchasing power for new bids is
  //    visible on each team's Budget page; this column gives a simpler "total
  //    money this phase" overview useful for league-wide visibility.
  const rows: TeamRow[] = teamList.map((team) => {
    const sponsor = sponsorIncome.get(team.id) ?? 0;

    const budget =
      team.phase_confirmed_id === phase.id
        ? team.treasury
        : team.treasury + sponsor;

    let status: TeamRow["status"];
    if (validatedTeamIds.has(team.id)) {
      status = "validated";
    } else if ((draftCount.get(team.id) ?? 0) > 0) {
      status = "pending";
    } else {
      status = "not_yet_bid";
    }

    return {
      team_id: team.id,
      team_name: team.name,
      budget,
      status,
    };
  });

  return (
    <div className="px-4 py-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          Round Status
        </h1>
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          When everyone has validated their bids, click &ldquo;Resolve
          Round&rdquo; to attribute riders and open the next round.
        </p>
      </header>

      {auction ? (
        <>
          <table className="w-full text-[length:var(--type-body)]">
            <thead>
              <tr className="text-left text-[length:var(--type-caption)] text-[var(--text-low)]">
                <th className="py-2">Team</th>
                <th className="py-2 text-right">Budget</th>
                <th className="py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.team_id}
                  className="border-t border-[var(--border-subtle)]"
                >
                  <td className="py-3 text-[var(--text-high)]">
                    {row.team_name}
                  </td>
                  <td className="py-3 text-right font-mono text-[var(--text-mid)]">
                    {formatEuro(row.budget)}
                  </td>
                  <td className="py-3 text-right">
                    {row.status === "validated" && (
                      <Tag variant="success">Validated</Tag>
                    )}
                    {row.status === "pending" && (
                      <Tag variant="highlighted">Pending</Tag>
                    )}
                    {row.status === "not_yet_bid" && (
                      <Tag variant="default">Not yet bid</Tag>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <StatusClient
            leagueId={leagueId}
            unvalidatedTeams={rows
              .filter((r) => r.status !== "validated")
              .map((r) => r.team_name)}
          />
        </>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-6 text-center">
          <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            No open round. Wait for the next round to begin.
          </p>
        </div>
      )}
    </div>
  );
}
