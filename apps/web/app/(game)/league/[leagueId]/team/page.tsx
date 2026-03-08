import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RiderCard } from "@/components/rider-card";
import { TeamLevelCard } from "@/components/team-level-card";
import { getMaxSlots } from "@/lib/levels";

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
    .select("id, team_id, teams:team_id(id, name, cumulative_xp, level)")
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

  const team = Array.isArray(member.teams) ? member.teams[0] : member.teams;

  const { data: teamRiders } = await supabase
    .from("contracts")
    .select(
      "id, rider_id, locked_salary, status, riders(id, full_name, nationality, real_team, pcs_rank, photo_url, specialty, pcs_points_1yr)"
    )
    .eq("team_id", team?.id)
    .in("status", ["active", "notice"]);

  // Pending bids from active auctions
  const { data: pendingBids } = await supabase
    .from("auction_bids")
    .select(
      "id, amount, rider_id, riders(id, full_name, nationality, real_team, pcs_rank, photo_url)"
    )
    .eq("team_id", team?.id)
    .eq("status", "active");

  const xp = team?.cumulative_xp ?? 0;
  const level = team?.level ?? 1;
  const maxSlots = getMaxSlots(level);
  const riderCount = teamRiders?.length ?? 0;

  return (
    <div className="py-4 space-y-6">
      {/* Header */}
      <div className="px-4 space-y-1">
        <div className="flex items-baseline gap-3">
          <span className="text-[32px] font-black font-mono leading-none tracking-tight text-[var(--accent-highlight)]">
            {xp.toLocaleString()} XP
          </span>
          <span className="text-sm font-semibold text-[var(--text-low)]">
            Ranked #—
          </span>
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

      {/* Pending Bids */}
      {pendingBids && pendingBids.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-4 mb-2">
            <span className="text-[15px] font-bold text-[var(--text-high)]">
              Pending Bids
            </span>
            <span className="text-xs font-semibold font-mono text-[var(--text-low)]">
              {pendingBids.length} bid{pendingBids.length > 1 ? "s" : ""}
            </span>
          </div>
          <div>
            {pendingBids.map((bid) => {
              const r = Array.isArray(bid.riders) ? bid.riders[0] : bid.riders;
              if (!r) return null;
              return (
                <RiderCard
                  key={bid.id}
                  rider={{
                    id: r.id,
                    name: formatName(r.full_name),
                    nationality_flag: r.nationality ?? undefined,
                    team_name: r.real_team ?? undefined,
                    pcs_rank: r.pcs_rank ?? undefined,
                    photo_url: r.photo_url,
                  }}
                  bidState="active"
                  rightContent={
                    <span className="text-sm font-bold font-mono text-[var(--accent-default)]">
                      {bid.amount.toLocaleString()} /mo
                    </span>
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Roster */}
      <div>
        <div className="flex items-center justify-between px-4 mb-2">
          <span className="text-[15px] font-bold text-[var(--text-high)]">
            Roster
          </span>
          <span className="text-xs font-semibold text-[var(--text-low)]">
            <span className="font-mono">{riderCount}/{maxSlots}</span> slots
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
                  team_name: r.real_team ?? undefined,
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
      <div className="px-4">
        <TeamLevelCard
          leagueId={leagueId}
          currentLevel={level}
          currentXp={xp}
          teamName={team?.name ?? undefined}
        />
      </div>
    </div>
  );
}
