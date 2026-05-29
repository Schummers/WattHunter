import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPhase } from "@/lib/phases";
import { formatEuro } from "@/lib/format";
import { getLevelByNumber } from "@/lib/levels";
import { Tag } from "@/components/pill";
import { RoundStepper } from "@/components/round-stepper";
import { StatusClient } from "./status-client";
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
} from "@/lib/demo-constants";

interface TeamRow {
  team_id: string;
  team_name: string;
  level: number;
  pool_min: number;
  slots_used: number;
  slots_max: number;
  budget: number;
  purchasing_power: number;
  status: "validated" | "auto_validated" | "pending" | "not_yet_bid";
}

export default async function StatusPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoAuctionStatus();

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

  // All-rounds (3 most recent, includes closed — for stepper)
  const { data: allRoundsRaw } = await supabase
    .from("auctions")
    .select("id, name, status, opens_at")
    .eq("league_id", leagueId)
    .order("opens_at", { ascending: false })
    .limit(3);
  const stepperRounds = (allRoundsRaw ?? []).reverse().map((r) => ({
    number: parseInt(r.name.replace("Round ", ""), 10),
    status: r.status as "open" | "scheduled" | "closed" | "resolving",
    opens_at: r.opens_at,
  }));

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
  const autoValidatedTeamIds = new Set<string>();
  if (auction && teamIds.length > 0) {
    const { data: validations } = await supabase
      .from("round_validations")
      .select("team_id, auto_validated")
      .eq("auction_id", auction.id)
      .in("team_id", teamIds);
    for (const v of validations ?? []) {
      validatedTeamIds.add(v.team_id);
      if (v.auto_validated) {
        autoValidatedTeamIds.add(v.team_id);
      }
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

  // 5. Active contracts per team (salaries + slot count)
  const activeSalaries = new Map<string, number>();
  const activeContractCount = new Map<string, number>();
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
      activeContractCount.set(
        c.team_id,
        (activeContractCount.get(c.team_id) ?? 0) + 1
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
  const rows: TeamRow[] = teamList.map((team) => {
    const sponsor = sponsorIncome.get(team.id) ?? 0;
    const levelData = getLevelByNumber(team.level);

    const budget =
      team.phase_confirmed_id === phase.id
        ? team.treasury
        : team.treasury + sponsor;

    const salaries = activeSalaries.get(team.id) ?? 0;
    const purchasing_power = budget - salaries;

    let status: TeamRow["status"];
    if (autoValidatedTeamIds.has(team.id)) {
      status = "auto_validated";
    } else if (validatedTeamIds.has(team.id)) {
      status = "validated";
    } else if ((draftCount.get(team.id) ?? 0) > 0) {
      status = "pending";
    } else {
      status = "not_yet_bid";
    }

    return {
      team_id: team.id,
      team_name: team.name,
      level: team.level,
      pool_min: levelData.poolMin,
      slots_used: activeContractCount.get(team.id) ?? 0,
      slots_max: levelData.slots,
      budget,
      purchasing_power,
      status,
    };
  });

  return (
    <div className="py-4">
      {/* Round stepper — always visible */}
      <div className="pb-3">
        <RoundStepper rounds={stepperRounds} />
      </div>
      <div className="border-t border-[var(--border-subtle)]" />

      {auction ? (
        <div className="px-4 pt-4">
          {/* Header row */}
          <div className="flex items-center text-[length:var(--type-caption)] text-[var(--text-low)] pb-2">
            <span className="flex-1">Team</span>
            <span className="w-24 text-right">Budget</span>
            <span className="w-24 text-right">Status</span>
            <span className="w-5" />
          </div>

          {/* Rows */}
          <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
            {rows.map((row) => (
              <Link
                key={row.team_id}
                href={`/league/${leagueId}/ranking/team/${row.team_id}?from=league`}
                className="flex py-3 transition-colors hover:bg-[var(--bg-surface-hover)]"
              >
                {/* Left: name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[length:var(--type-body)] font-semibold text-[var(--text-high)] truncate">
                      {row.team_name}
                    </span>
                    <span className="text-[length:var(--type-caption)] text-[var(--text-low)] shrink-0">
                      Lv.<span className="font-mono">{row.level}</span>
                    </span>
                  </div>
                  <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
                    Pool Top {row.pool_min} · {row.slots_used}/{row.slots_max} slots
                  </span>
                </div>

                {/* Budget / purchasing power */}
                <div className="w-24 text-right font-mono flex flex-col justify-center">
                  {row.purchasing_power === row.budget ? (
                    <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
                      {formatEuro(row.budget)}
                    </span>
                  ) : (
                    <>
                      <span className="text-[length:var(--type-caption)] text-[var(--text-low)] line-through">
                        {formatEuro(row.budget)}
                      </span>
                      <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
                        {formatEuro(row.purchasing_power)}
                      </span>
                    </>
                  )}
                </div>

                {/* Status */}
                <div className="w-24 flex items-center justify-end">
                  {row.status === "validated" && (
                    <Tag variant="success">Validated</Tag>
                  )}
                  {row.status === "auto_validated" && (
                    <Tag variant="default">Auto-validated</Tag>
                  )}
                  {row.status === "pending" && (
                    <Tag variant="highlighted">Pending</Tag>
                  )}
                  {row.status === "not_yet_bid" && (
                    <Tag variant="default">Not yet bid</Tag>
                  )}
                </div>

                <ChevronRight size={16} className="ml-1 shrink-0 self-center text-[var(--text-ghost)]" />
              </Link>
            ))}
          </div>

          <StatusClient
            leagueId={leagueId}
            unvalidatedTeams={rows
              .filter((r) => r.status !== "validated" && r.status !== "auto_validated")
              .map((r) => r.team_name)}
          />
        </div>
      ) : (
        <div className="px-4 pt-4">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-6 text-center">
            <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
              No open round. Wait for the next round to begin.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demo path — anonymous visitor, no auth required
// ---------------------------------------------------------------------------
async function renderDemoAuctionStatus() {
  const supabase = await createClient();
  const leagueId = DEMO_LEAGUE_ID;
  const phase = getCurrentPhase();

  const { data: auction } = await supabase
    .from("auctions")
    .select("id, name, opens_at, league_id")
    .eq("league_id", leagueId)
    .eq("status", "open")
    .order("opens_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: allRoundsRaw } = await supabase
    .from("auctions")
    .select("id, name, status, opens_at")
    .eq("league_id", leagueId)
    .order("opens_at", { ascending: false })
    .limit(3);
  const stepperRounds = (allRoundsRaw ?? []).reverse().map((r) => ({
    number: parseInt(r.name.replace("Round ", ""), 10),
    status: r.status as "open" | "scheduled" | "closed" | "resolving",
    opens_at: r.opens_at,
  }));

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, treasury, level, phase_confirmed_id")
    .eq("league_id", leagueId)
    .order("name", { ascending: true });

  const teamList = teams ?? [];
  const teamIds = teamList.map((t) => t.id);

  const validatedTeamIds = new Set<string>();
  const autoValidatedTeamIds = new Set<string>();
  if (auction && teamIds.length > 0) {
    const { data: validations } = await supabase
      .from("round_validations")
      .select("team_id, auto_validated")
      .eq("auction_id", auction.id)
      .in("team_id", teamIds);
    for (const v of validations ?? []) {
      validatedTeamIds.add(v.team_id);
      if (v.auto_validated) autoValidatedTeamIds.add(v.team_id);
    }
  }

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

  const activeSalaries = new Map<string, number>();
  const activeContractCount = new Map<string, number>();
  if (teamIds.length > 0) {
    const { data: contracts } = await supabase
      .from("contracts")
      .select("team_id, locked_salary")
      .in("team_id", teamIds)
      .eq("status", "active");
    for (const c of contracts ?? []) {
      activeSalaries.set(c.team_id, (activeSalaries.get(c.team_id) ?? 0) + (c.locked_salary ?? 0));
      activeContractCount.set(c.team_id, (activeContractCount.get(c.team_id) ?? 0) + 1);
    }
  }

  const sponsorIncome = new Map<string, number>();
  if (teamIds.length > 0) {
    const { data: tsRows } = await supabase
      .from("team_sponsors")
      .select("team_id, sponsors:sponsor_id(monthly_budget)")
      .in("team_id", teamIds);
    for (const ts of tsRows ?? []) {
      const sponsor = Array.isArray(ts.sponsors) ? ts.sponsors[0] : ts.sponsors;
      const budget = (sponsor as { monthly_budget?: number } | null)?.monthly_budget ?? 0;
      sponsorIncome.set(ts.team_id, budget);
    }
  }

  const rows: TeamRow[] = teamList.map((team) => {
    const sponsor = sponsorIncome.get(team.id) ?? 0;
    const levelData = getLevelByNumber(team.level);
    const budget = team.phase_confirmed_id === phase.id ? team.treasury : team.treasury + sponsor;
    const salaries = activeSalaries.get(team.id) ?? 0;
    const purchasing_power = budget - salaries;

    let status: TeamRow["status"];
    if (autoValidatedTeamIds.has(team.id)) {
      status = "auto_validated";
    } else if (validatedTeamIds.has(team.id)) {
      status = "validated";
    } else if ((draftCount.get(team.id) ?? 0) > 0) {
      status = "pending";
    } else {
      status = "not_yet_bid";
    }

    return {
      team_id: team.id,
      team_name: team.name,
      level: team.level,
      pool_min: levelData.poolMin,
      slots_used: activeContractCount.get(team.id) ?? 0,
      slots_max: levelData.slots,
      budget,
      purchasing_power,
      status,
    };
  });

  return (
    <div className="py-4">
      <div className="pb-3">
        <RoundStepper rounds={stepperRounds} />
      </div>
      <div className="border-t border-[var(--border-subtle)]" />

      {auction ? (
        <div className="px-4 pt-4">
          <div className="flex items-center text-[length:var(--type-caption)] text-[var(--text-low)] pb-2">
            <span className="flex-1">Team</span>
            <span className="w-24 text-right">Budget</span>
            <span className="w-24 text-right">Status</span>
            <span className="w-5" />
          </div>

          <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
            {rows.map((row) => (
              <Link
                key={row.team_id}
                href={`/league/${DEMO_LEAGUE_SLUG}/ranking/team/${row.team_id}?from=league`}
                className="flex py-3 transition-colors hover:bg-[var(--bg-surface-hover)]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[length:var(--type-body)] font-semibold text-[var(--text-high)] truncate">
                      {row.team_name}
                    </span>
                    <span className="text-[length:var(--type-caption)] text-[var(--text-low)] shrink-0">
                      Lv.<span className="font-mono">{row.level}</span>
                    </span>
                  </div>
                  <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
                    Pool Top {row.pool_min} · {row.slots_used}/{row.slots_max} slots
                  </span>
                </div>
                <div className="w-24 text-right font-mono flex flex-col justify-center">
                  {row.purchasing_power === row.budget ? (
                    <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
                      {formatEuro(row.budget)}
                    </span>
                  ) : (
                    <>
                      <span className="text-[length:var(--type-caption)] text-[var(--text-low)] line-through">
                        {formatEuro(row.budget)}
                      </span>
                      <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
                        {formatEuro(row.purchasing_power)}
                      </span>
                    </>
                  )}
                </div>
                <div className="w-24 flex items-center justify-end">
                  {row.status === "validated" && <Tag variant="success">Validated</Tag>}
                  {row.status === "auto_validated" && <Tag variant="default">Auto-validated</Tag>}
                  {row.status === "pending" && <Tag variant="highlighted">Pending</Tag>}
                  {row.status === "not_yet_bid" && <Tag variant="default">Not yet bid</Tag>}
                </div>
                <ChevronRight size={16} className="ml-1 shrink-0 self-center text-[var(--text-ghost)]" />
              </Link>
            ))}
          </div>

          <StatusClient
            leagueId={DEMO_LEAGUE_SLUG}
            unvalidatedTeams={rows
              .filter((r) => r.status !== "validated" && r.status !== "auto_validated")
              .map((r) => r.team_name)}
          />
        </div>
      ) : (
        <div className="px-4 pt-4">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-6 text-center">
            <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
              No open round. Wait for the next round to begin.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
