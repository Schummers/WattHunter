import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentGTPhase,
  getNextGTPhase,
  GT_FULL_NAME,
  GT_SHORT_NAME,
  GT_IDENTIFIER,
  type GtPhaseId,
} from "@/lib/gt-phases";
import { resolveRaceTeamLabel } from "@/lib/race-team-label";
import { getSquadWithRoles, getAvailableRiders } from "./actions";
import { GtTeamClient } from "./gt-team-client";
import type { SponsorRow } from "@/lib/sponsors";
import { getGtStages } from "@/lib/gt-stages";
import {
  listTacticActivations,
  getEligibleRivals,
  getMyLeaderXp,
  getIncomingNemesis,
} from "./tactics/actions";
import type { ActivationLite } from "@/components/team-tactics-section";
import type { IncomingNemesis } from "@/components/nemesis-incoming-banner";
import { DEMO_LEAGUE_SLUG } from "@/lib/demo-constants";
import { ScoringDocCard } from "@/components/scoring-doc-card";

export default async function GtTeamPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  if (leagueId === DEMO_LEAGUE_SLUG) return renderDemoTeamGt();

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

  const currentGT = getCurrentGTPhase();

  if (!currentGT) {
    const next = getNextGTPhase();
    return <InactiveView next={next} />;
  }

  const phaseId = currentGT.id as GtPhaseId;
  const year = new Date().getFullYear();
  const raceTeamLabel = await resolveRaceTeamLabel(supabase, team.id);

  const [squad, availableRiders, teamSponsorRes] = await Promise.all([
    getSquadWithRoles({ teamId: team.id, phaseId, year }),
    getAvailableRiders({ teamId: team.id, phaseId, year }),
    supabase
      .from("team_sponsors")
      .select("sponsors:sponsor_id(*)")
      .eq("team_id", team.id)
      .maybeSingle(),
  ]);

  const sponsor = (Array.isArray(teamSponsorRes.data?.sponsors)
    ? teamSponsorRes.data?.sponsors[0]
    : teamSponsorRes.data?.sponsors) as SponsorRow | null | undefined;
  const gtSlug = `race/${GT_IDENTIFIER[phaseId]}/${year}`;

  const [activations, stages, gcRivals, sprintRivals, myGc, mySprinter, incomings, goalCompletionsRes] =
    await Promise.all([
      listTacticActivations({ teamId: team.id, phaseId, year }),
      getGtStages(supabase, { phaseId, year, teamId: team.id }),
      getEligibleRivals({ leagueId, myTeamId: team.id, phaseId, year, role: "gc_leader" }),
      getEligibleRivals({ leagueId, myTeamId: team.id, phaseId, year, role: "sprinter" }),
      getMyLeaderXp({ teamId: team.id, phaseId, year, role: "gc_leader" }),
      getMyLeaderXp({ teamId: team.id, phaseId, year, role: "sprinter" }),
      getIncomingNemesis({ teamId: team.id, phaseId, year }),
      (supabase as any)
        .from("sponsor_goal_completions")
        .select("goal_index")
        .eq("team_id", team.id)
        .eq("race_slug", gtSlug),
    ]);

  const myGcXp = myGc.leader ? myGc.xp : 0;
  const mySprintXp = mySprinter.leader ? mySprinter.xp : 0;
  const eligibleGcRivals = gcRivals.filter((r) => r.xp >= myGcXp);
  const eligibleSprintRivals = sprintRivals.filter((r) => r.xp >= mySprintXp);
  const completedGoalIndices: number[] = (goalCompletionsRes?.data ?? []).map(
    (r: { goal_index: number }) => r.goal_index,
  );

  return (
    <>
      <div className="mb-4">
        <ScoringDocCard />
      </div>
      <GtTeamClient
        teamId={team.id}
        phaseId={phaseId}
        year={year}
        gtFullName={raceTeamLabel}
        squad={squad}
        availableRiders={availableRiders}
        sponsor={sponsor ?? null}
        completedGoalIndices={completedGoalIndices}
        activations={activations as ActivationLite[]}
        stages={stages}
        eligibleGcRivals={eligibleGcRivals}
        eligibleSprintRivals={eligibleSprintRivals}
        myGcLeader={myGc.leader ? { name: myGc.leader.name, xp: myGc.xp } : null}
        mySprinter={mySprinter.leader ? { name: mySprinter.leader.name, xp: mySprinter.xp } : null}
        incomingNemesis={incomings as IncomingNemesis[]}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Demo path — anonymous visitor, no auth required
// ---------------------------------------------------------------------------
function renderDemoTeamGt() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
        Demo league has no Grand Tour data yet.
      </p>
    </div>
  );
}

function InactiveView({ next }: { next: ReturnType<typeof getNextGTPhase> }) {
  if (!next) {
    return (
      <div className="p-8 text-center">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          No upcoming Grand Tour this season.
        </p>
      </div>
    );
  }
  const year = new Date().getFullYear();
  const start = new Date(year, next.startMonth - 1, next.startDay);
  const days = Math.max(0, Math.ceil((start.getTime() - Date.now()) / 86_400_000));
  const short = GT_SHORT_NAME[next.id as GtPhaseId];

  // NOTE: this preview is GT-only for now. A 1-week race variant
  // ("NEXT RACE" — Paris-Nice / Dauphiné / Suisse / …) is deferred until the
  // 1-week race detection lands behind `resolveRaceTeamLabel`.
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <span className="text-[length:var(--type-label)] uppercase tracking-wide text-[var(--text-low)]">
        NEXT GRAND TOUR
      </span>
      <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
        {GT_FULL_NAME[next.id as GtPhaseId]}
      </h1>
      <p className="text-[length:var(--type-caption)] text-[var(--text-mid)]">
        Starts {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · in{" "}
        {days} days
      </p>
      <p className="max-w-sm text-[length:var(--type-caption)] text-[var(--text-ghost)]">
        Build your squad when the {short} phase begins.
      </p>
    </div>
  );
}
