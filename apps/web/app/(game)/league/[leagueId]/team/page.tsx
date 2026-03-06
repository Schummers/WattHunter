import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RiderCard } from "@/components/rider-card";
import { Progress } from "@/components/ui/progress";

const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0, slots: 6 },
  { level: 2, xp: 100, slots: 7 },
  { level: 3, xp: 250, slots: 7 },
  { level: 4, xp: 500, slots: 8 },
  { level: 5, xp: 900, slots: 9 },
  { level: 6, xp: 1500, slots: 9 },
  { level: 7, xp: 2500, slots: 10 },
  { level: 8, xp: 4000, slots: 11 },
  { level: 9, xp: 6000, slots: 11 },
  { level: 10, xp: 9000, slots: 12 },
];

function getLevelInfo(level: number) {
  const currentIdx = Math.max(
    0,
    LEVEL_THRESHOLDS.findIndex((l) => l.level === level)
  );
  const current = LEVEL_THRESHOLDS[currentIdx];
  const next =
    currentIdx < LEVEL_THRESHOLDS.length - 1
      ? LEVEL_THRESHOLDS[currentIdx + 1]
      : null;
  return { current, next };
}

function getProgressPct(xp: number, level: number): number {
  const { current, next } = getLevelInfo(level);
  if (!next) return 100;
  const range = next.xp - current.xp;
  if (range <= 0) return 100;
  return Math.min(100, Math.round(((xp - current.xp) / range) * 100));
}

function getMaxSlots(level: number): number {
  const entry = LEVEL_THRESHOLDS.find((l) => l.level === level);
  return entry?.slots ?? 6;
}

function formatName(fullName: string): string {
  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length <= 1) return fullName;
  const lastName = parts[parts.length - 1];
  const firstInitial = parts[0][0].toUpperCase();
  return `${firstInitial}. ${lastName}`;
}

export default async function MyTeamPage({
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
          Please sign in to view your team.
        </p>
      </div>
    );
  }

  const { data: member } = await supabase
    .from("league_members")
    .select("id, team_name, xp, level, role")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return (
      <div className="px-4 py-8">
        <p className="text-sm text-[var(--text-mid)]">
          You are not a member of this league.
        </p>
      </div>
    );
  }

  const { data: teamRiders } = await supabase
    .from("team_riders")
    .select(
      "id, rider_id, salary, riders(id, full_name, nationality, team_name, pcs_rank, photo_url, specialty, pcs_points_1yr)"
    )
    .eq("league_member_id", member.id)
    .eq("status", "active");

  const xp = member.xp ?? 0;
  const level = member.level ?? 1;
  const maxSlots = getMaxSlots(level);
  const riderCount = teamRiders?.length ?? 0;
  const progressPct = getProgressPct(xp, level);
  const { next } = getLevelInfo(level);

  return (
    <div className="px-4 py-4 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-black text-[var(--accent-highlight)]">
            {xp.toLocaleString()} XP
          </span>
          <Link
            href={`/league/${leagueId}/ranking`}
            className="text-sm font-semibold text-[var(--accent-default)]"
          >
            Ranked #—
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/league/${leagueId}/team/policies`}
            className="text-sm text-[var(--accent-default)]"
          >
            Policies &rarr;
          </Link>
        </div>
      </div>

      {/* Roster */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-base font-bold text-[var(--text-high)]">
            Roster
          </span>
          <span className="text-xs font-semibold text-[var(--text-low)]">
            {riderCount}/{maxSlots} slots
          </span>
        </div>

        <div>
          {teamRiders?.map((tr) => {
            const r = Array.isArray(tr.riders) ? tr.riders[0] : tr.riders;
            if (!r) return null;
            return (
              <RiderCard
                key={tr.id}
                rider={{
                  id: r.id,
                  name: formatName(r.full_name),
                  nationality_flag: r.nationality ?? undefined,
                  team_name: r.team_name ?? undefined,
                  pcs_rank: r.pcs_rank ?? undefined,
                  photo_url: r.photo_url,
                }}
                xp={r.pcs_points_1yr ?? 0}
                href={`/league/${leagueId}/rider/${r.id}`}
              />
            );
          })}

          {/* Open slots */}
          {Array.from({ length: maxSlots - riderCount }).map((_, i) => (
            <RiderCard
              key={`open-${i}`}
              rider={{ id: "", name: "" }}
              isOpenSlot
              href={`/league/${leagueId}/team/recruts`}
            />
          ))}
        </div>
      </div>

      {/* Team Level */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)]">
            <span className="text-base font-bold text-[var(--text-high)]">
              {level}
            </span>
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text-high)]">
                Level {level}
              </span>
              {next && (
                <span className="text-xs text-[var(--text-low)]">
                  {xp.toLocaleString()} / {next.xp.toLocaleString()} XP
                </span>
              )}
            </div>
            <Progress value={progressPct} />
          </div>
        </div>
        <Link
          href={`/league/${leagueId}/levels`}
          className="text-sm text-[var(--accent-default)]"
        >
          See all &rarr;
        </Link>
      </div>
    </div>
  );
}
