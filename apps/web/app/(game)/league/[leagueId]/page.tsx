import { Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LobbyView } from "./lobby-view";
import { RaceFeed } from "@/components/race-feed";
import { getRaceFeedData } from "@/lib/get-race-feed-data";
import type { TacticContextForFeed } from "@/lib/race-feed-types";


export default async function LeagueDashboardPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: league }, { data: members }, { count: memberCount }] =
    await Promise.all([
      supabase
        .from("leagues")
        .select("id, name, invite_code, commissioner_id, status, max_players")
        .eq("id", leagueId)
        .single(),
      supabase
        .from("league_members")
        .select("user_id, users(display_name, avatar_url), teams:team_id(name)")
        .eq("league_id", leagueId),
      supabase
        .from("league_members")
        .select("id", { count: "exact", head: true })
        .eq("league_id", leagueId),
    ]);

  if (!league || !user) {
    return <p className="text-[var(--text-mid)]">League not found.</p>;
  }

  const isCommissioner = league.commissioner_id === user.id;
  const isPending = league.status === "pending";

  if (isPending) {
    const normalizedMembers = (members ?? []).map((m) => ({
      user_id: m.user_id as string,
      users: Array.isArray(m.users) ? m.users[0] ?? null : m.users ?? null,
      teams: Array.isArray(m.teams) ? m.teams[0] ?? null : (m.teams as { name: string } | null) ?? null,
    }));

    return (
      <LobbyView
        league={league}
        members={normalizedMembers}
        memberCount={memberCount ?? 0}
        isCommissioner={isCommissioner}
      />
    );
  }

  // --- Active league: load race feed ---

  const { count: closedCount } = await supabase
    .from("auctions")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueId)
    .eq("status", "closed");

  const { data: memberRow } = await supabase
    .from("league_members")
    .select("team_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  const teamId = memberRow?.team_id ?? null;

  const { data: teamSponsorRow } = teamId
    ? await supabase
        .from("team_sponsors")
        .select("id")
        .eq("team_id", teamId)
        .maybeSingle()
    : { data: null };

  const isLateJoinPending = teamSponsorRow === null && (closedCount ?? 0) > 0;

  const raceFeedPayload = teamId
    ? await getRaceFeedData(supabase, { leagueId, myTeamId: teamId })
    : { groups: [], nextPhaseRound1Date: null, nextPhaseLabel: null, isGtPhase: false, phaseId: 0 };

  // Fetch tactic context for GT phases (powers the inline tactic modal on future stage cards)
  let tacticContext: TacticContextForFeed | null = null;
  if (raceFeedPayload.isGtPhase && teamId) {
    const phaseId = raceFeedPayload.phaseId as 4 | 6 | 8;
    const year = new Date().getFullYear();

    const [teamRows, activationRows, gcRoleRows, sprintRoleRows] = await Promise.all([
      supabase.from("teams").select("id, name").eq("league_id", leagueId),
      supabase
        .from("gt_tactic_activations")
        .select("tactic_type, stage_slug, outcome")
        .eq("team_id", teamId)
        .eq("phase_id", phaseId)
        .eq("year", year),
      supabase
        .from("gt_role_assignments")
        .select("team_id, riders(full_name)")
        .eq("phase_id", phaseId)
        .eq("year", year)
        .eq("role", "gc_leader")
        .order("applied_at", { ascending: false }),
      supabase
        .from("gt_role_assignments")
        .select("team_id, riders(full_name)")
        .eq("phase_id", phaseId)
        .eq("year", year)
        .eq("role", "sprinter")
        .order("applied_at", { ascending: false }),
    ]);

    // Latest role assignment per team (rows ordered desc by applied_at)
    const gcByTeam = new Map<string, string | null>();
    for (const row of gcRoleRows.data ?? []) {
      if (!gcByTeam.has(row.team_id)) {
        gcByTeam.set(row.team_id, row.riders ? (row.riders as { full_name: string }).full_name : null);
      }
    }
    const sprintByTeam = new Map<string, string | null>();
    for (const row of sprintRoleRows.data ?? []) {
      if (!sprintByTeam.has(row.team_id)) {
        sprintByTeam.set(row.team_id, row.riders ? (row.riders as { full_name: string }).full_name : null);
      }
    }

    const rivals = (teamRows.data ?? []).filter((t) => t.id !== teamId);
    tacticContext = {
      teamId,
      phaseId,
      year,
      activations: (activationRows.data ?? []).map((a) => ({
        tactic_type: a.tactic_type,
        stage_slug: a.stage_slug,
        outcome: (a.outcome as string | null) ?? null,
      })),
      gcRivals: rivals.map((t) => ({ teamId: t.id, teamName: t.name, leaderName: gcByTeam.get(t.id) ?? null })),
      sprintRivals: rivals.map((t) => ({ teamId: t.id, teamName: t.name, leaderName: sprintByTeam.get(t.id) ?? null })),
    };
  }

  // Fetch DNF riders for this team during an active GT phase
  // Card stays visible throughout the GT, with state derived from claim + bid status
  type DnfRider = {
    leagueId: string;
    gtSquadId: string;
    contractId: string;
    riderName: string;
    photoUrl: string | null;
    dnfStage: number;
    gtXp: number;
    refundAmount: number;
    initialClaimed?: boolean;
    hasActiveBid?: boolean;
  };
  const dnfRiders: DnfRider[] = [];

  if (teamId && raceFeedPayload.isGtPhase) {
    const currentYear = new Date().getFullYear();

    // Fetch ALL DNF entries (claimed or not) + active emergency bids
    const [{ data: allDnfRows }, { data: activeBids }] = await Promise.all([
      supabase
        .from("gt_squad")
        .select(
          `id, dnf_stage, phase_id, year, rider_id, dnf_refund_claimed,
           riders:rider_id ( id, full_name, photo_url )`
        )
        .eq("team_id", teamId)
        .eq("phase_id", raceFeedPayload.phaseId)
        .eq("year", currentYear)
        .not("dnf_stage", "is", null),
      supabase
        .from("gt_emergency_bids")
        .select("rider_id")
        .eq("team_id", teamId)
        .eq("phase_id", raceFeedPayload.phaseId)
        .eq("gt_year", currentYear)
        .eq("resolved", false),
    ]);

    const hasActiveBid = (activeBids ?? []).length > 0;

    if (allDnfRows && allDnfRows.length > 0) {
      const riderIds = allDnfRows.map((r) => r.rider_id as string);

      // Fetch contracts regardless of status (refund auto-releases the contract)
      const { data: contracts } = await supabase
        .from("contracts")
        .select("id, rider_id, locked_salary, status")
        .eq("team_id", teamId)
        .in("rider_id", riderIds)
        .in("status", ["active", "released"]);

      const contractByRider = new Map(
        (contracts ?? []).map((c) => [c.rider_id as string, c])
      );

      const phaseToGtSlug: Record<number, string> = {
        4: "race/giro-d-italia",
        6: "race/tour-de-france",
        8: "race/vuelta-a-espana",
      };

      for (const row of allDnfRows) {
        const rider = Array.isArray(row.riders) ? row.riders[0] : row.riders;
        const contract = contractByRider.get(row.rider_id as string);
        if (!rider || !contract) continue;

        const isClaimed = (row as { dnf_refund_claimed?: boolean }).dnf_refund_claimed === true;
        const gtSlugPrefix = phaseToGtSlug[row.phase_id as number];
        const year = row.year as number;

        let gtXp = 0;
        if (gtSlugPrefix && !isClaimed) {
          const { data: xpRows } = await supabase
            .from("rider_xp_daily")
            .select("xp_gained")
            .eq("team_id", teamId)
            .eq("rider_id", (rider as { id: string }).id)
            .like("race_slug", `${gtSlugPrefix}/${year}%`);

          gtXp = Math.round(
            (xpRows ?? []).reduce(
              (sum, r) => sum + Number((r as { xp_gained: number }).xp_gained ?? 0),
              0
            )
          );
        }

        const typedRider = rider as { id: string; full_name: string; photo_url: string | null };

        dnfRiders.push({
          leagueId,
          gtSquadId: row.id,
          contractId: contract.id,
          riderName: typedRider.full_name,
          photoUrl: typedRider.photo_url,
          dnfStage: row.dnf_stage as number,
          gtXp,
          refundAmount: Math.round((contract.locked_salary as number) * 0.5),
          initialClaimed: isClaimed,
          hasActiveBid,
        });
      }
    }
  }

  return (
    <>
      {isLateJoinPending && (
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-[var(--text-mid)]" />
          <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
            You joined mid-season. You can select your sponsor and start bidding at the next auction phase.
          </p>
        </div>
      )}
      <RaceFeed leagueId={leagueId} payload={raceFeedPayload} tacticContext={tacticContext} dnfRiders={dnfRiders} />
    </>
  );
}
