import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { RailLink } from "@/components/rail-link";
import { createClient } from "@/lib/supabase/server";
import { RiderCard } from "@/components/rider-card";
import { TeamLevelCard } from "@/components/team-level-card";
import { getMaxSlots } from "@/lib/levels";
import { formatThousands, smartCountdown, countryCodeToFlag } from "@/lib/format";
import { calculateBoost } from "@/lib/boost";

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
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
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
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
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

  // Pending bids from active auctions — include outbid/lost for lifecycle (MT-9)
  const { data: pendingBids } = await supabase
    .from("auction_bids")
    .select(
      "id, amount, status, rider_id, auction_id, riders(id, full_name, nationality, real_team, pcs_rank, photo_url)"
    )
    .eq("team_id", team?.id)
    .in("status", ["active", "outbid", "lost"]);

  // Fetch active auction for round info (MT-8)
  const auctionIds = [...new Set(pendingBids?.map((b) => b.auction_id) ?? [])];
  let activeAuction: { name: string; closes_at: string } | null = null;
  if (auctionIds.length > 0) {
    const { data: auction } = await supabase
      .from("auctions")
      .select("name, closes_at")
      .eq("id", auctionIds[0])
      .single();
    activeAuction = auction;
  }

  // Ranking query (MT-1): count teams with higher XP
  const xp = team?.cumulative_xp ?? 0;
  const level = team?.level ?? 1;
  const { count: teamsAbove } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueId)
    .gt("cumulative_xp", xp);
  const { count: totalTeams } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueId);

  const rank = (teamsAbove ?? 0) + 1;
  const teamCount = totalTeams ?? 0;

  const maxSlots = getMaxSlots(level);
  const riderCount = teamRiders?.length ?? 0;

  // Fetch active policies for boost calculation (MT-3)
  const { data: activePolicies } = await supabase
    .from("team_policies")
    .select("policy_id, config, policies:policy_id(slug, xp_bonus)")
    .eq("team_id", team?.id)
    .eq("is_active", true);

  const boostPolicies = (activePolicies ?? []).map((tp) => {
    const p = Array.isArray(tp.policies) ? tp.policies[0] : tp.policies;
    return {
      slug: (p as { slug: string })?.slug ?? "",
      xp_bonus: (p as { xp_bonus: number })?.xp_bonus ?? 0,
      config: tp.config as Record<string, string> | null,
    };
  });

  const boostRiders = (teamRiders ?? []).map((tr) => {
    const r = Array.isArray(tr.riders) ? tr.riders[0] : tr.riders;
    return {
      nationality: r?.nationality ?? null,
      real_team: r?.real_team ?? null,
      specialty: r?.specialty ?? null,
      birthdate: null as string | null, // birthdate not in contracts join
    };
  });

  const boostPct = calculateBoost(boostPolicies, boostRiders);

  // Filter bids: active ones first, then outbid (dimmed)
  const activeBids = pendingBids?.filter((b) => b.status === "active") ?? [];
  const outbidBids = pendingBids?.filter((b) => b.status === "outbid") ?? [];
  const allBids = [...activeBids, ...outbidBids];

  return (
    <div className="py-4 space-y-6">
      {/* Header — 2 metric blocks (MT-1) */}
      <div className="px-4">
        <div className="flex gap-3">
          {/* Left: Total XP Season */}
          <div className="flex-1 space-y-0.5">
            <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
              Total XP Season
            </span>
            <div className="text-[length:var(--type-display)] font-black font-mono leading-none tracking-tight text-[var(--accent-highlight)]">
              {xp.toLocaleString()}
            </div>
            <span className="text-[length:var(--type-caption)] text-[var(--text-low)]">
              Updated after each race
            </span>
          </div>

          {/* Right: Ranking (MT-2 — tappable) */}
          <Link
            href={`/league/${leagueId}/ranking`}
            className="flex items-center gap-1.5 self-start rounded-lg px-3 py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            <div className="space-y-0.5">
              <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                Ranking
              </span>
              <div className="text-[length:var(--type-stat)] font-extrabold font-mono leading-none text-[var(--text-high)]">
                {rank}<span className="text-[length:var(--type-emphasis)] font-semibold font-mono text-[var(--text-low)]">/{teamCount}</span>
              </div>
            </div>
            <ChevronRight size={14} className="text-[var(--text-ghost)]" />
          </Link>
        </div>

        {/* Boost pill + Change policies link (MT-3 + MT-4) */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-mid)] bg-white/5 rounded-full px-2.5 py-0.5">
            +{boostPct}% Boost
          </span>
          <RailLink
            href={`/league/${leagueId}/team/policies`}
            className="text-[length:var(--type-body)] link-tertiary"
          >
            Change policies &rarr;
          </RailLink>
        </div>
      </div>

      {/* Separator (MT-5) */}
      <div className="mx-4 border-t border-[var(--border-subtle)]" />

      {/* Roster (MT-6 — before Pending Bids) */}
      <div>
        <div className="flex items-center justify-between px-4 mb-2">
          <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Roster
          </span>
          <span className="text-[length:var(--type-caption)] font-semibold text-[var(--text-low)]">
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
                  nationality_flag: r.nationality ? countryCodeToFlag(r.nationality) : undefined,
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

      {/* Pending Bids (MT-8 round info, MT-9 lifecycle, MT-10 no /mo, MT-14 clickable) */}
      {allBids.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-4 mb-2">
            <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
              Pending Bids
            </span>
            {activeAuction && (
              <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-low)]">
                {activeAuction.name} · closes {smartCountdown(activeAuction.closes_at)}
              </span>
            )}
          </div>
          <div>
            {allBids.map((bid) => {
              const r = Array.isArray(bid.riders) ? bid.riders[0] : bid.riders;
              if (!r) return null;
              const isOutbid = bid.status === "outbid";
              return (
                <RiderCard
                  key={bid.id}
                  rider={{
                    id: r.id,
                    name: formatName(r.full_name),
                    nationality_flag: r.nationality ? countryCodeToFlag(r.nationality) : undefined,
                    team_name: r.real_team ?? undefined,
                    pcs_rank: r.pcs_rank ?? undefined,
                    photo_url: r.photo_url,
                  }}
                  bidState={isOutbid ? "outbid" : "active"}
                  href={`/league/${leagueId}/rider/${r.id}?from=recruts`}
                  rightContent={
                    <span className={`text-[length:var(--type-body)] font-bold font-mono ${isOutbid ? "text-[var(--text-low)]" : "text-[var(--accent-default)]"}`}>
                      {formatThousands(bid.amount)} €
                    </span>
                  }
                />
              );
            })}
          </div>
        </div>
      )}

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
