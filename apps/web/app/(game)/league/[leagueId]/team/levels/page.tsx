import { createClient } from "@/lib/supabase/server";
import { BackHeader } from "@/components/back-header";
import { Progress } from "@/components/ui/progress";
import { Check, Lock } from "lucide-react";

const LEVELS = [
  { level: 1, xp: 0, slots: 6, pool: "#401 -> #500", policy: "Speciality", maxActive: 1 },
  { level: 2, xp: 100, slots: 7, pool: "#301 -> #500", policy: null, maxActive: 1 },
  { level: 3, xp: 250, slots: 7, pool: "#201 -> #500", policy: "Nationality", maxActive: 1 },
  { level: 4, xp: 500, slots: 8, pool: "#151 -> #500", policy: null, maxActive: 1 },
  { level: 5, xp: 900, slots: 9, pool: "#101 -> #500", policy: "Teams", maxActive: 2 },
  { level: 6, xp: 1500, slots: 9, pool: "#76 -> #500", policy: null, maxActive: 2 },
  { level: 7, xp: 2500, slots: 10, pool: "#51 -> #500", policy: "Age", maxActive: 2 },
  { level: 8, xp: 4000, slots: 11, pool: "#26 -> #500", policy: null, maxActive: 2 },
  { level: 9, xp: 6000, slots: 11, pool: "#11 -> #500", policy: null, maxActive: 2 },
  { level: 10, xp: 9000, slots: 12, pool: "#1 -> #500", policy: null, maxActive: 2 },
];

function getProgressPct(xp: number, currentLevel: number): number {
  const currentIdx = LEVELS.findIndex((l) => l.level === currentLevel);
  if (currentIdx < 0) return 0;
  const current = LEVELS[currentIdx];
  const next = currentIdx < LEVELS.length - 1 ? LEVELS[currentIdx + 1] : null;
  if (!next) return 100;
  const range = next.xp - current.xp;
  if (range <= 0) return 100;
  return Math.min(100, Math.round(((xp - current.xp) / range) * 100));
}

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
    .select("id, level, xp")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  const currentLevel = member?.level ?? 1;
  const currentXp = member?.xp ?? 0;
  const progressPct = getProgressPct(currentXp, currentLevel);

  // Next level XP target
  const currentIdx = LEVELS.findIndex((l) => l.level === currentLevel);
  const nextLevel = currentIdx < LEVELS.length - 1 ? LEVELS[currentIdx + 1] : null;

  return (
    <div className="min-h-screen">
      <BackHeader label="My Team" />

      <div className="px-4 space-y-6">
        {/* Hero */}
        <div className="flex flex-col items-center space-y-3 py-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-highlight)]">
            <span className="text-2xl font-black text-[var(--bg-app)]">
              {currentLevel}
            </span>
          </div>
          <div className="text-center space-y-1">
            <p className="text-lg font-bold text-[var(--text-high)]">
              Level {currentLevel}
            </p>
            <p className="text-sm text-[var(--text-mid)]">
              {currentXp.toLocaleString()} XP
              {nextLevel && (
                <span className="text-[var(--text-low)]">
                  {" "}/ {nextLevel.xp.toLocaleString()} XP
                </span>
              )}
            </p>
          </div>
          <div className="w-full max-w-[200px]">
            <Progress value={progressPct} />
          </div>
        </div>

        {/* Level list */}
        <div className="space-y-0">
          {LEVELS.map((lvl) => {
            const isDone = lvl.level < currentLevel;
            const isCurrent = lvl.level === currentLevel;
            const isLocked = lvl.level > currentLevel;

            return (
              <div
                key={lvl.level}
                className={`flex items-start gap-3 py-4 ${
                  isCurrent
                    ? "border-l-2 border-l-[var(--accent-default)] pl-3"
                    : "pl-[14px]"
                } ${
                  lvl.level < LEVELS.length
                    ? "border-b border-b-[var(--border-subtle)]"
                    : ""
                }`}
              >
                {/* Level badge */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isDone
                      ? "bg-[var(--accent-default)]"
                      : isCurrent
                      ? "bg-[var(--accent-highlight)]"
                      : "bg-[var(--bg-surface)]"
                  }`}
                >
                  {isDone ? (
                    <Check
                      size={16}
                      className="text-[var(--bg-app)]"
                    />
                  ) : isLocked ? (
                    <Lock size={14} className="text-[var(--text-ghost)]" />
                  ) : (
                    <span
                      className={`text-sm font-bold ${
                        isCurrent
                          ? "text-[var(--bg-app)]"
                          : "text-[var(--text-ghost)]"
                      }`}
                    >
                      {lvl.level}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-semibold ${
                        isLocked
                          ? "text-[var(--text-low)]"
                          : "text-[var(--text-high)]"
                      }`}
                    >
                      Level {lvl.level}
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--accent-default)]">
                        In progress
                      </span>
                    )}
                    {isDone && (
                      <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-low)]">
                        {lvl.xp.toLocaleString()} XP
                      </span>
                    )}
                    {isLocked && (
                      <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-ghost)]">
                        {lvl.xp.toLocaleString()} XP
                      </span>
                    )}
                  </div>

                  {/* Progress bar for current level */}
                  {isCurrent && (
                    <div className="pt-1">
                      <Progress value={progressPct} />
                    </div>
                  )}

                  {/* Details */}
                  <div
                    className={`flex flex-wrap gap-x-3 gap-y-0.5 text-xs ${
                      isLocked ? "text-[var(--text-ghost)]" : "text-[var(--text-mid)]"
                    }`}
                  >
                    <span>{lvl.slots} slots</span>
                    <span>{lvl.pool}</span>
                    <span>{lvl.maxActive} max policies</span>
                  </div>

                  {/* Policy unlock */}
                  {lvl.policy && (
                    <div
                      className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isLocked
                          ? "bg-[var(--bg-surface)] text-[var(--text-ghost)]"
                          : "bg-[var(--accent-muted)] text-[var(--accent-default)]"
                      }`}
                    >
                      + {lvl.policy}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
