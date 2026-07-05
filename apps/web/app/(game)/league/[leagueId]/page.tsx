import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RaceFeed } from "@/components/race-feed";
import { TourJerseyCallout } from "@/components/tour-jersey-callout";
import { getRaceFeedData } from "@/lib/get-race-feed-data";
import type { TacticContextForFeed } from "@/lib/race-feed-types";
import { getAchievementBySlug } from "@/lib/achievements";
import { getTourJerseyHolders, mapJerseysToTeams, TOUR_JERSEY_SLUG } from "@/lib/tour-jerseys";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

/**
 * Resolves the live Grand Tour jersey (if any) the given team currently wears,
 * via a targeted contracts lookup scoped to just the 2-3 current jersey
 * holders — cheap enough to run on every home page load. See lib/tour-jerseys.ts.
 */
async function getMyTourJerseyAchievement(supabase: SupabaseClient, teamId: string) {
  const holders = await getTourJerseyHolders(supabase);
  if (holders.size === 0) return undefined;

  const holderRiderIds = [...holders.keys()];
  const { data: myHolderContracts } = await supabase
    .from("contracts")
    .select("rider_id")
    .eq("team_id", teamId)
    .eq("status", "active")
    .in("rider_id", holderRiderIds);

  const riderTeamMap = new Map<string, string>();
  for (const c of (myHolderContracts ?? []) as Array<{ rider_id: string }>) {
    riderTeamMap.set(c.rider_id, teamId);
  }

  const jersey = mapJerseysToTeams(holders, riderTeamMap).get(teamId) ?? null;
  return jersey ? getAchievementBySlug(TOUR_JERSEY_SLUG[jersey]) : undefined;
}


export default async function LeagueDashboardPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  if (leagueId === DEMO_LEAGUE_SLUG) {
    return await renderDemoHome();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: league }] = await Promise.all([
    supabase
      .from("leagues")
      .select("id, name, invite_code, commissioner_id, status, max_players")
      .eq("id", leagueId)
      .single(),
  ]);

  if (!league || !user) {
    return <p className="text-[var(--text-mid)]">League not found.</p>;
  }

  const isPending = league.status === "pending";

  if (isPending) {
    redirect(`/lobby/${leagueId}`);
  }

  // --- Active league: load race feed ---

  const { data: memberRow } = await supabase
    .from("league_members")
    .select("team_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  const teamId = memberRow?.team_id ?? null;

  const myJerseyAchievement = teamId
    ? await getMyTourJerseyAchievement(supabase, teamId)
    : undefined;

  const raceFeedPayload = teamId
    ? await getRaceFeedData(supabase, { leagueId, myTeamId: teamId })
    : { groups: [], nextPhaseRound1Date: null, nextPhaseLabel: null, isGtPhase: false, phaseId: 0 };

  // Fetch tactic context for GT phases (powers the inline tactic modal on future stage cards)
  let tacticContext: TacticContextForFeed | null = null;
  if (raceFeedPayload.isGtPhase && teamId) {
    const phaseId = raceFeedPayload.phaseId as 4 | 6 | 8;
    const year = new Date().getFullYear();

    const gtSlugForPhase = ({ 4: "giro-d-italia", 6: "tour-de-france", 8: "vuelta-a-espana" } as const)[phaseId];

    const [teamRows, activationRows] = await Promise.all([
      supabase.from("teams").select("id, name").eq("league_id", leagueId),
      supabase
        .from("gt_tactic_activations")
        .select("tactic_type, stage_slug, outcome")
        .eq("team_id", teamId)
        .eq("phase_id", phaseId)
        .eq("year", year),
    ]);

    const teamIdsInLeague = (teamRows.data ?? []).map((t) => t.id);

    const [squadRows, xpRows] = await Promise.all([
      supabase
        .from("gt_squad")
        .select("team_id, rider_id, role, riders(full_name)")
        .in("team_id", teamIdsInLeague)
        .eq("phase_id", phaseId)
        .eq("year", year)
        .in("role", ["gc_leader", "sprinter"])
        .is("removed_at", null),
      supabase
        .from("rider_xp_daily")
        .select("team_id, rider_id, xp_gained")
        .in("team_id", teamIdsInLeague)
        .like("race_slug", `race/${gtSlugForPhase}/${year}/%`),
    ]);

    const xpMap = new Map<string, number>();
    for (const row of xpRows.data ?? []) {
      const key = `${row.team_id}:${row.rider_id}`;
      xpMap.set(key, (xpMap.get(key) ?? 0) + (row.xp_gained ?? 0));
    }

    type SquadRoleRow = { team_id: string; rider_id: string; role: string; riders: { full_name: string } | null };
    const gcByTeam = new Map<string, SquadRoleRow>();
    const sprintByTeam = new Map<string, SquadRoleRow>();
    for (const row of (squadRows.data ?? []) as SquadRoleRow[]) {
      if (row.role === "gc_leader") gcByTeam.set(row.team_id, row);
      if (row.role === "sprinter") sprintByTeam.set(row.team_id, row);
    }

    const allTeams = teamRows.data ?? [];
    const rivals = allTeams.filter((t) => t.id !== teamId);
    const myGcRow = gcByTeam.get(teamId);
    const mySprintRow = sprintByTeam.get(teamId);

    tacticContext = {
      teamId,
      phaseId,
      year,
      activations: (activationRows.data ?? []).map((a) => ({
        tactic_type: a.tactic_type,
        stage_slug: a.stage_slug,
        outcome: (a.outcome as string | null) ?? null,
      })),
      gcRivals: rivals.map((t) => {
        const row = gcByTeam.get(t.id);
        return {
          teamId: t.id,
          teamName: t.name,
          leaderName: row?.riders?.full_name ?? null,
          leaderId: row?.rider_id ?? null,
          xp: row ? (xpMap.get(`${t.id}:${row.rider_id}`) ?? 0) : 0,
        };
      }),
      sprintRivals: rivals.map((t) => {
        const row = sprintByTeam.get(t.id);
        return {
          teamId: t.id,
          teamName: t.name,
          leaderName: row?.riders?.full_name ?? null,
          leaderId: row?.rider_id ?? null,
          xp: row ? (xpMap.get(`${t.id}:${row.rider_id}`) ?? 0) : 0,
        };
      }),
      myGcLeader: myGcRow
        ? { name: myGcRow.riders?.full_name ?? "Unknown", xp: xpMap.get(`${teamId}:${myGcRow.rider_id}`) ?? 0 }
        : null,
      mySprinter: mySprintRow
        ? { name: mySprintRow.riders?.full_name ?? "Unknown", xp: xpMap.get(`${teamId}:${mySprintRow.rider_id}`) ?? 0 }
        : null,
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

    // Per-rider Set: rider_ids that have an unresolved emergency bid
    const activeBidRiderIds = new Set(
      (activeBids ?? []).map((b) => b.rider_id as string)
    );

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
        const hasActiveBidForRider = activeBidRiderIds.has(row.rider_id as string);

        // Hide card when refund is claimed AND no pending bid — nothing left to act on
        if (isClaimed && !hasActiveBidForRider) continue;

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
          hasActiveBid: hasActiveBidForRider,
        });
      }
    }
  }

  return (
    <>
      {myJerseyAchievement && (
        <TourJerseyCallout
          badgeUrl={myJerseyAchievement.badgeUrl}
          bannerUrl={myJerseyAchievement.bannerUrl}
          tier={myJerseyAchievement.tier}
          achievementName={myJerseyAchievement.name}
        />
      )}
      <RaceFeed leagueId={leagueId} payload={raceFeedPayload} tacticContext={tacticContext} dnfRiders={dnfRiders} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Demo path — anonymous visitor, no auth required
// ---------------------------------------------------------------------------
// TODO(demo): apply "use cache" + cacheTag("demo-league") + cacheLife({ revalidate: 3600 })
// once Cache Components (experimental.useCache) is enabled project-wide in next.config.ts.
// For v1 the fetch is cheap enough without caching (demo league is small and PostgREST
// connection pooling amortises the queries).
//
// Tactic context and DNF cards are intentionally omitted here:
//   - Tactic decisions are per-player and meaningless for a read-only demo visitor.
//   - DNF rescue cards depend on the live GT calendar which fluctuates during the season.
//   - The Race Feed (past stages, sponsor income, XP breakdown) is rich enough on its own.
async function renderDemoHome() {
  const supabase = await createClient();

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name")
    .eq("id", DEMO_LEAGUE_ID)
    .maybeSingle();

  if (!league) {
    return <p className="text-[var(--text-mid)]">Demo unavailable.</p>;
  }

  const raceFeedPayload = await getRaceFeedData(supabase, {
    leagueId: DEMO_LEAGUE_ID,
    myTeamId: DEMO_VISITOR_TEAM_ID,
  });

  const myJerseyAchievement = await getMyTourJerseyAchievement(supabase, DEMO_VISITOR_TEAM_ID);

  return (
    <>
      {myJerseyAchievement && (
        <TourJerseyCallout
          badgeUrl={myJerseyAchievement.badgeUrl}
          bannerUrl={myJerseyAchievement.bannerUrl}
          tier={myJerseyAchievement.tier}
          achievementName={myJerseyAchievement.name}
        />
      )}
      <RaceFeed
        leagueId={DEMO_LEAGUE_SLUG}
        payload={raceFeedPayload}
        tacticContext={null}
        dnfRiders={[]}
      />
    </>
  );
}
