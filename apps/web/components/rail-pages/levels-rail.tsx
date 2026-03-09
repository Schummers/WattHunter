"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { LevelsTimeline } from "@/app/(game)/league/[leagueId]/levels/levels-timeline";
import { getProgressPct, getNextLevel } from "@/lib/levels";

interface Props {
  leagueId: string;
}

export default function LevelsRail({ leagueId }: Props) {
  const [loading, setLoading] = useState(true);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentXp, setCurrentXp] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: member } = await supabase
        .from("league_members")
        .select("id, team_id, teams:team_id(name, level, cumulative_xp)")
        .eq("league_id", leagueId)
        .eq("user_id", user.id)
        .single();

      if (!cancelled && member) {
        const team = Array.isArray(member.teams) ? member.teams[0] : member.teams;
        setCurrentLevel((team as any)?.level ?? 1);
        setCurrentXp((team as any)?.cumulative_xp ?? 0);
      }
      if (!cancelled) setLoading(false);
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

  const progressPct = getProgressPct(currentXp, currentLevel);
  const nextLevel = getNextLevel(currentLevel);

  return (
    <div className="px-4 pt-4 space-y-6">
      <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
        Team Progression
      </h1>
      <LevelsTimeline
        currentLevel={currentLevel}
        currentXp={currentXp}
        progressPct={progressPct}
        nextLevelXp={nextLevel?.xp ?? currentXp}
      />
    </div>
  );
}
