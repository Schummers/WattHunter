import { createClient } from "@/lib/supabase/server";
import { BackHeader } from "@/components/back-header";
import { LevelsTimeline } from "./levels-timeline";
import { LEVELS, getProgressPct, getNextLevel } from "@/lib/levels";

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
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          Please sign in to view levels.
        </p>
      </div>
    );
  }

  const { data: member } = await supabase
    .from("league_members")
    .select("id, team_id, teams:team_id(name, level, cumulative_xp)")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  const team = member?.teams
    ? Array.isArray(member.teams) ? member.teams[0] : member.teams
    : null;
  const currentLevel = team?.level ?? 1;
  const currentXp = team?.cumulative_xp ?? 0;
  const progressPct = getProgressPct(currentXp, currentLevel);
  const nextLevel = getNextLevel(currentLevel);

  return (
    <div className="min-h-screen">
      <BackHeader label="Back" />

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
    </div>
  );
}
