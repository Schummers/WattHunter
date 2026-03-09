"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { POLICY_TYPES } from "@/lib/policies";
import { PoliciesClient } from "@/app/(game)/league/[leagueId]/team/policies/policies-client";

interface Props {
  leagueId: string;
}

export default function PoliciesRail({ leagueId }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    teamId: string;
    level: number;
    initialPolicies: Record<string, { isActive: boolean; config: Record<string, string> | null }>;
    nationalities: string[];
    teams: string[];
    rosterRiders: { nationality: string | null; real_team: string | null; specialty: string | null; birthdate: string | null }[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: member } = await supabase
        .from("league_members")
        .select("id, team_id, teams:team_id(id, level)")
        .eq("league_id", leagueId)
        .eq("user_id", user.id)
        .single();

      if (!member || cancelled) { setLoading(false); return; }

      const team = Array.isArray(member.teams) ? member.teams[0] : member.teams;
      const teamId = (team as any)?.id ?? "";
      const level = (team as any)?.level ?? 1;

      // Fetch policies DB
      const { data: dbPolicies } = await supabase.from("policies").select("id, slug");
      const { data: teamPolicies } = await supabase
        .from("team_policies")
        .select("policy_id, is_active, config")
        .eq("team_id", teamId);

      const policyIdToSlug: Record<string, string> = {};
      for (const p of dbPolicies ?? []) policyIdToSlug[p.id] = p.slug;

      const initialPolicies: Record<string, { isActive: boolean; config: Record<string, string> | null }> = {};
      for (const pt of POLICY_TYPES) initialPolicies[pt.slug] = { isActive: false, config: null };
      for (const tp of teamPolicies ?? []) {
        const slug = policyIdToSlug[tp.policy_id];
        if (slug && initialPolicies[slug] !== undefined) {
          initialPolicies[slug] = { isActive: tp.is_active, config: tp.config as Record<string, string> | null };
        }
      }

      // Dynamic options
      const { data: natData } = await supabase.from("riders").select("nationality").not("nationality", "is", null);
      const nationalities = [...new Set((natData ?? []).map((r) => r.nationality).filter(Boolean))] as string[];
      nationalities.sort();

      const { data: tData } = await supabase.from("riders").select("real_team").not("real_team", "is", null);
      const teams = [...new Set((tData ?? []).map((r) => r.real_team).filter(Boolean))] as string[];
      teams.sort();

      // Roster
      const { data: contracts } = await supabase
        .from("contracts")
        .select("riders(nationality, real_team, specialty, birthdate)")
        .eq("team_id", teamId)
        .in("status", ["active", "notice"]);

      const rosterRiders = (contracts ?? []).map((c) => {
        const r = Array.isArray(c.riders) ? c.riders[0] : c.riders;
        return {
          nationality: r?.nationality ?? null,
          real_team: r?.real_team ?? null,
          specialty: r?.specialty ?? null,
          birthdate: (r as any)?.birthdate ?? null,
        };
      });

      if (!cancelled) {
        setData({ teamId, level, initialPolicies, nationalities, teams, rosterRiders });
        setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [leagueId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-6 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-default)]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-8">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          Unable to load policies.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4">
      <PoliciesClient
        teamId={data.teamId}
        leagueId={leagueId}
        level={data.level}
        initialPolicies={data.initialPolicies}
        nationalities={data.nationalities}
        teams={data.teams}
        rosterRiders={data.rosterRiders}
      />
    </div>
  );
}
