import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentGTPhase,
  getNextGTPhase,
  getCurrentGTStage,
  GT_FULL_NAME,
  GT_SHORT_NAME,
  GT_IDENTIFIER,
  type GtPhaseId,
} from "@/lib/gt-phases";
import { ensureGtSquad, getSquadWithRoles } from "./actions";
import { GtTeamClient } from "./gt-team-client";
import { RemontadaBannerSlot } from "./_remontada-banner-slot";
import { getGoalsForSponsor } from "@/lib/gt-goals";
import type { SponsorRow } from "@/lib/sponsors";

export default async function GtTeamPage({
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

  const currentGT = getCurrentGTPhase();

  // Inactive: show a preview of the next GT.
  if (!currentGT) {
    const next = getNextGTPhase();
    return <InactiveView next={next} />;
  }

  const phaseId = currentGT.id as GtPhaseId;
  const year = new Date().getFullYear();

  await ensureGtSquad({ teamId: team.id, phaseId, year });
  const squad = await getSquadWithRoles({ teamId: team.id, phaseId, year });

  const { data: teamSponsor } = await supabase
    .from("team_sponsors")
    .select("sponsors:sponsor_id(*)")
    .eq("team_id", team.id)
    .maybeSingle();

  const sponsor = (Array.isArray(teamSponsor?.sponsors)
    ? teamSponsor?.sponsors[0]
    : teamSponsor?.sponsors) as SponsorRow | null | undefined;
  const goals = sponsor ? getGoalsForSponsor(sponsor.slug) : [];

  const currentStage = getCurrentGTStage();

  return (
    <>
      {currentStage !== null && (
        <RemontadaBannerSlot
          teamId={team.id}
          gtIdentifier={GT_IDENTIFIER[phaseId]}
          currentStageNumber={currentStage}
        />
      )}
      <GtTeamClient
        teamId={team.id}
        phaseId={phaseId}
        year={year}
        gtFullName={GT_FULL_NAME[phaseId]}
        gtShortName={GT_SHORT_NAME[phaseId]}
        squad={squad}
        sponsor={sponsor ?? null}
        goals={goals}
      />
    </>
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
        The GT squad unlocks automatically when the {short} phase begins.
      </p>
    </div>
  );
}
