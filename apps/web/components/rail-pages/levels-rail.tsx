"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { TeamLevelCard } from "@/components/team-level-card";
import { Progress } from "@/components/ui/progress";
import { LEVELS, getProgressPct, getNewUnlocks, getNextLevel } from "@/lib/levels";

interface Props {
  leagueId: string;
}

export default function LevelsRail({ leagueId }: Props) {
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("My Team");
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
        setTeamName((team as any)?.name ?? "My Team");
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

  return (
    <div>
      <div className="px-4 pt-4 space-y-3">
        <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
          {teamName} progression
        </h1>
        <TeamLevelCard
          leagueId={leagueId}
          currentLevel={currentLevel}
          currentXp={currentXp}
          hideHeader
        />
      </div>

      <div className="px-4 pt-6">
        {LEVELS.map((lvl) => {
          const isCurrent = lvl.level === currentLevel;
          const isFuture = lvl.level > currentLevel;
          const progressPct = isCurrent ? getProgressPct(currentXp, currentLevel) : 0;
          const nextLevelData = getNextLevel(lvl.level);
          const unlocks = getNewUnlocks(lvl.level);

          return (
            <div
              key={lvl.level}
              className={`py-4 ${
                lvl.level < LEVELS.length ? "border-b border-[var(--border-subtle)]" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[length:var(--type-section)] ${
                    isCurrent
                      ? "font-bold text-[var(--text-high)]"
                      : isFuture
                      ? "font-semibold text-[var(--text-low)]"
                      : "font-semibold text-[var(--text-high)]"
                  }`}
                >
                  Level {lvl.level}
                </span>
                <span
                  className={`text-[length:var(--type-caption)] font-mono ${
                    isCurrent
                      ? "text-[var(--accent-default)]"
                      : isFuture
                      ? "text-[var(--text-ghost)]"
                      : "text-[var(--text-low)]"
                  }`}
                >
                  {isCurrent
                    ? `${currentXp.toLocaleString()} / ${nextLevelData ? nextLevelData.xp.toLocaleString() : currentXp.toLocaleString()} XP`
                    : `${lvl.xp.toLocaleString()} XP`}
                </span>
              </div>

              {isCurrent && (
                <div className="mt-2">
                  <Progress value={progressPct} />
                </div>
              )}

              {unlocks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {unlocks.map((pill) => (
                    <span
                      key={pill}
                      className={`rounded-full px-2.5 py-0.5 text-[length:var(--type-caption)] font-medium ${
                        isFuture
                          ? "bg-[var(--bg-surface)] text-[var(--text-ghost)]"
                          : "bg-[var(--text-high)] text-[var(--bg-app)]"
                      }`}
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
