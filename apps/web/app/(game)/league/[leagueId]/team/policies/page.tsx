import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { BackHeader } from "@/components/back-header";
import { POLICY_TYPES } from "@/lib/policies";
import { PoliciesClient } from "./policies-client";
import { getCurrentPhase, getNextPhase, isInAuctionWindow, isLeagueFirstCycle } from "@/lib/phases";

export default async function PoliciesPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const user = await getUser();

  if (!user) {
    return (
      <div className="px-4 py-8">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          Please sign in to view policies.
        </p>
      </div>
    );
  }

  const { data: member } = await supabase
    .from("league_members")
    .select("id, team_id, teams:team_id(id, level)")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  const team = member?.teams
    ? Array.isArray(member.teams) ? member.teams[0] : member.teams
    : null;
  const level = team?.level ?? 1;
  const teamId = (team as { id: string })?.id ?? "";

  // All remaining queries depend only on teamId — run in parallel
  const [
    { data: dbPolicies },
    { data: teamPolicies },
    { data: nationalitiesData },
    { data: teamsData },
    { data: contracts },
  ] = await Promise.all([
    supabase
      .from("policies")
      .select("id, slug"),
    supabase
      .from("team_policies")
      .select("policy_id, is_active, config, pending_is_active, pending_config")
      .eq("team_id", teamId),
    supabase
      .from("riders")
      .select("nationality")
      .not("nationality", "is", null)
      .order("nationality"),
    supabase
      .from("riders")
      .select("real_team")
      .not("real_team", "is", null)
      .order("real_team"),
    supabase
      .from("contracts")
      .select("riders(nationality, real_team, specialty, birthdate)")
      .eq("team_id", teamId)
      .eq("status", "active"),
  ]);

  // Build initial policies map
  const policyIdToSlug: Record<string, string> = {};
  for (const p of dbPolicies ?? []) {
    policyIdToSlug[p.id] = p.slug;
  }

  const nextPhase = getNextPhase(getCurrentPhase());
  const nextPhaseName = nextPhase?.label ?? null;

  const initialPolicies: Record<string, {
    isActive: boolean;
    config: Record<string, string> | null;
    hasPending?: boolean;
    pendingIsActive?: boolean;
    pendingConfig?: Record<string, string> | null;
  }> = {};
  for (const pt of POLICY_TYPES) {
    initialPolicies[pt.slug] = { isActive: false, config: null };
  }
  for (const tp of teamPolicies ?? []) {
    const slug = policyIdToSlug[tp.policy_id];
    if (slug && initialPolicies[slug] !== undefined) {
      initialPolicies[slug] = {
        isActive: tp.is_active,
        config: tp.config as Record<string, string> | null,
        hasPending: tp.pending_is_active != null,
        pendingIsActive: tp.pending_is_active ?? undefined,
        pendingConfig: tp.pending_config as Record<string, string> | null ?? undefined,
      };
    }
  }

  const nationalities = [...new Set((nationalitiesData ?? []).map((r) => r.nationality).filter(Boolean))] as string[];
  const teams = [...new Set((teamsData ?? []).map((r) => r.real_team).filter(Boolean))] as string[];

  const rosterRiders = (contracts ?? []).map((c) => {
    const r = Array.isArray(c.riders) ? c.riders[0] : c.riders;
    return {
      nationality: r?.nationality ?? null,
      real_team: r?.real_team ?? null,
      specialty: r?.specialty ?? null,
      birthdate: (r as { birthdate?: string | null })?.birthdate ?? null,
    };
  });

  return (
    <div className="min-h-screen">
      <BackHeader label="My Team" />

      <h1 className="px-4 pt-4 text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
        Team Policies
      </h1>

      <div className="px-4 pt-4">
        <PoliciesClient
          teamId={teamId}
          leagueId={leagueId}
          level={level}
          initialPolicies={initialPolicies}
          nationalities={nationalities}
          teams={teams}
          rosterRiders={rosterRiders}
          nextPhaseName={nextPhaseName}
          isInAuctionWindow={isInAuctionWindow() || await isLeagueFirstCycle(supabase, leagueId)}
        />
      </div>
    </div>
  );
}
