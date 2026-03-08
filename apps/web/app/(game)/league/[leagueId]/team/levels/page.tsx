import { createClient } from "@/lib/supabase/server";
import { BackHeader } from "@/components/back-header";
import { TeamLevelCard } from "@/components/team-level-card";
import { Progress } from "@/components/ui/progress";
import { LEVELS, getProgressPct, getNewUnlocks, getNextLevel } from "@/lib/levels";

export default async function LevelsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="px-4 py-8">
        <p className="text-sm text-[var(--text-mid)]">
          Please sign in to view levels.
        </p>
      </div>
    );
  }

  const { data: member } = await supabase
    .from("league_members")
    .select("id, team_id, teams:team_id(level, cumulative_xp)")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  const team = member?.teams
    ? Array.isArray(member.teams) ? member.teams[0] : member.teams
    : null;
  const currentLevel = team?.level ?? 1;
  const currentXp = team?.cumulative_xp ?? 0;

  return (
    <div className="min-h-screen">
      <BackHeader label="My Team" />

      {/* Hero — reuses TeamLevelCard without header */}
      <div className="px-4 pt-4">
        <TeamLevelCard
          leagueId={leagueId}
          currentLevel={currentLevel}
          currentXp={currentXp}
          hideHeader
        />
      </div>

      {/* All levels list */}
      <div className="px-4 pt-6">
        {LEVELS.map((lvl) => {
          const isDone = lvl.level < currentLevel;
          const isCurrent = lvl.level === currentLevel;
          const isFuture = lvl.level > currentLevel;
          const progressPct = isCurrent ? getProgressPct(currentXp, currentLevel) : 0;
          const nextLevelData = getNextLevel(lvl.level);
          const unlocks = getNewUnlocks(lvl.level);

          return (
            <div
              key={lvl.level}
              className={`py-4 ${
                lvl.level < LEVELS.length
                  ? "border-b border-[var(--border-subtle)]"
                  : ""
              }`}
            >
              {/* Level title + XP */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-[15px] ${
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
                  className={`text-xs font-mono ${
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

              {/* Progress bar for current level */}
              {isCurrent && (
                <div className="mt-2">
                  <Progress value={progressPct} />
                </div>
              )}

              {/* Unlock pills */}
              {unlocks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {unlocks.map((pill) => (
                    <span
                      key={pill}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                        isFuture
                          ? "border-[var(--border-subtle)] text-[var(--text-ghost)]"
                          : "border-[var(--border-default)] text-[var(--text-mid)]"
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
