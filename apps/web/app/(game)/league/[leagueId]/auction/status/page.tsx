import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPhase } from "@/lib/phases";
import { formatMoney } from "@/lib/format";
import { getLevelByNumber } from "@/lib/levels";
import {
  isClassic,
  CLASSIC_SQUAD_SIZE,
  ROUNDS_PER_PHASE,
  type LeagueMode,
} from "@/lib/league-mode";
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
  /**
   * What this table is for: seeing at a glance who still owes the league their
   * bids. "Validated" and "auto-validated" both mean the same thing to the reader
   * (their bids are in), so they collapse into `done` rather than splitting the
   * eye between two badges that demand the same non-action.
   */
  status: "done" | "in_progress" | "not_started";
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

  // All-rounds (most recent, includes closed — for stepper). A phase now runs up
  // to 5 rounds, so a limit of 3 would hide the tail of the stepper.
  const { data: allRoundsRaw } = await supabase
    .from("auctions")
    .select("id, name, status, opens_at")
    .eq("league_id", leagueId)
    .order("opens_at", { ascending: false })
    .limit(ROUNDS_PER_PHASE);
  const stepperRounds = (allRoundsRaw ?? []).reverse().map((r) => ({
    number: parseInt(r.name.replace("Round ", ""), 10),
    status: r.status as "open" | "scheduled" | "closed" | "resolving",
    opens_at: r.opens_at,
  }));

  // 1b. League mode: classic caps every squad at CLASSIC_SQUAD_SIZE regardless of
  //     level, so the level-derived ceiling would read 12 where the game allows 10.
  const { data: league } = await supabase
    .from("leagues")
    .select("mode")
    .eq("id", leagueId)
    .maybeSingle();
  const leagueMode = (league?.mode ?? "manager") as LeagueMode;

  // 2. All teams in the league
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, treasury, level, phase_confirmed_id")
    .eq("league_id", leagueId)
    .order("name", { ascending: true });

  const teamList = teams ?? [];
  const teamIds = teamList.map((t) => t.id);

  // 3. round_validations for this auction (if any). auto_validated is not
  //    selected: the status model no longer distinguishes it (see TeamRow.status).
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

  // 5b. Bids committed in the open round. Slots filled by a signed contract alone
  //     read 0/10 for the whole of round 1, which tells the reader nothing about
  //     who has actually acted. Pending bids are the committed, public part.
  const activeBidCount = new Map<string, number>();
  if (auction && teamIds.length > 0) {
    const { data: bids } = await supabase
      .from("auction_bids")
      .select("team_id")
      .eq("auction_id", auction.id)
      .eq("status", "active")
      .in("team_id", teamIds);
    for (const b of bids ?? []) {
      activeBidCount.set(b.team_id, (activeBidCount.get(b.team_id) ?? 0) + 1);
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
    if (validatedTeamIds.has(team.id)) {
      status = "done";
    } else if ((draftCount.get(team.id) ?? 0) > 0) {
      status = "in_progress";
    } else {
      status = "not_started";
    }

    return {
      team_id: team.id,
      team_name: team.name,
      level: team.level,
      pool_min: levelData.poolMin,
      slots_used:
        (activeContractCount.get(team.id) ?? 0) + (activeBidCount.get(team.id) ?? 0),
      slots_max: isClassic(leagueMode) ? CLASSIC_SQUAD_SIZE : levelData.slots,
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
            <span className="w-28 text-right">Status</span>
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
                <div className="w-20 text-right font-mono flex flex-col justify-center shrink-0">
                  {row.purchasing_power === row.budget ? (
                    <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
                      {formatMoney(row.budget)}
                    </span>
                  ) : (
                    <>
                      <span className="text-[length:var(--type-caption)] text-[var(--text-low)] line-through">
                        {formatMoney(row.budget)}
                      </span>
                      <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
                        {formatMoney(row.purchasing_power)}
                      </span>
                    </>
                  )}
                </div>

                {/* Status */}
                <div className="w-28 flex items-center justify-end shrink-0">
                  {row.status === "done" && <Tag variant="success">Done</Tag>}
                  {row.status === "in_progress" && (
                    <Tag variant="highlighted">Bidding</Tag>
                  )}
                  {row.status === "not_started" && (
                    <Tag variant="default">Waiting</Tag>
                  )}
                </div>

                <ChevronRight size={16} className="ml-1 shrink-0 self-center text-[var(--text-ghost)]" />
              </Link>
            ))}
          </div>

          <StatusClient
            leagueId={leagueId}
            unvalidatedTeams={rows
              .filter((r) => r.status !== "done")
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
    .limit(ROUNDS_PER_PHASE);
  const stepperRounds = (allRoundsRaw ?? []).reverse().map((r) => ({
    number: parseInt(r.name.replace("Round ", ""), 10),
    status: r.status as "open" | "scheduled" | "closed" | "resolving",
    opens_at: r.opens_at,
  }));

  const { data: league } = await supabase
    .from("leagues")
    .select("mode")
    .eq("id", leagueId)
    .maybeSingle();
  const leagueMode = (league?.mode ?? "manager") as LeagueMode;

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, treasury, level, phase_confirmed_id")
    .eq("league_id", leagueId)
    .order("name", { ascending: true });

  const teamList = teams ?? [];
  const teamIds = teamList.map((t) => t.id);

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

  const activeBidCount = new Map<string, number>();
  if (auction && teamIds.length > 0) {
    const { data: bids } = await supabase
      .from("auction_bids")
      .select("team_id")
      .eq("auction_id", auction.id)
      .eq("status", "active")
      .in("team_id", teamIds);
    for (const b of bids ?? []) {
      activeBidCount.set(b.team_id, (activeBidCount.get(b.team_id) ?? 0) + 1);
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
    if (validatedTeamIds.has(team.id)) {
      status = "done";
    } else if ((draftCount.get(team.id) ?? 0) > 0) {
      status = "in_progress";
    } else {
      status = "not_started";
    }

    return {
      team_id: team.id,
      team_name: team.name,
      level: team.level,
      pool_min: levelData.poolMin,
      slots_used:
        (activeContractCount.get(team.id) ?? 0) + (activeBidCount.get(team.id) ?? 0),
      slots_max: isClassic(leagueMode) ? CLASSIC_SQUAD_SIZE : levelData.slots,
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
            <span className="w-28 text-right">Status</span>
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
                <div className="w-20 text-right font-mono flex flex-col justify-center shrink-0">
                  {row.purchasing_power === row.budget ? (
                    <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
                      {formatMoney(row.budget)}
                    </span>
                  ) : (
                    <>
                      <span className="text-[length:var(--type-caption)] text-[var(--text-low)] line-through">
                        {formatMoney(row.budget)}
                      </span>
                      <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
                        {formatMoney(row.purchasing_power)}
                      </span>
                    </>
                  )}
                </div>
                <div className="w-28 flex items-center justify-end shrink-0">
                  {row.status === "done" && <Tag variant="success">Done</Tag>}
                  {row.status === "in_progress" && <Tag variant="highlighted">Bidding</Tag>}
                  {row.status === "not_started" && <Tag variant="default">Waiting</Tag>}
                </div>
                <ChevronRight size={16} className="ml-1 shrink-0 self-center text-[var(--text-ghost)]" />
              </Link>
            ))}
          </div>

          <StatusClient
            leagueId={DEMO_LEAGUE_SLUG}
            unvalidatedTeams={rows
              .filter((r) => r.status !== "done")
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
