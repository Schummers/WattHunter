import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { BackHeader } from "@/components/back-header";
import { MetricBox } from "@/components/metric-box";
import { MovementTag } from "@/components/movement-tag";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatThousands, countryCodeToFlag } from "@/lib/format";
import { getLevelForXp } from "@/lib/levels";

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function resolvePhoto(url: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `https://www.procyclingstats.com/${url}`;
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ leagueId: string; teamId: string }>;
}) {
  const { leagueId, teamId } = await params;
  const supabase = await createClient();

  const user = await getUser();

  if (!user) redirect("/login");

  // Verify team belongs to this league
  const { data: team } = await supabase
    .from("teams")
    .select("id, name, cumulative_xp, level, league_id")
    .eq("id", teamId)
    .single();

  if (!team || team.league_id !== leagueId) {
    return (
      <div className="px-4 py-8">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">Team not found.</p>
      </div>
    );
  }

  // Parallelize: owner member lookup and ranking count are independent
  const [{ data: ownerMember }, { count: higherCount }] = await Promise.all([
    supabase
      .from("league_members")
      .select("user_id, users(display_name)")
      .eq("team_id", teamId)
      .eq("league_id", leagueId)
      .maybeSingle(),
    supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .gt("cumulative_xp", team.cumulative_xp),
  ]);

  const ownerUser = ownerMember
    ? (Array.isArray(ownerMember.users) ? ownerMember.users[0] : ownerMember.users)
    : null;
  const ownerDisplayName = (ownerUser as { display_name?: string })?.display_name ?? "Unknown";

  const rankPosition = (higherCount ?? 0) + 1;

  // All contracts for this team, join riders
  const { data: contractsRaw } = await supabase
    .from("contracts")
    .select("id, rider_id, status, riders:rider_id(id, full_name, nationality, photo_url, pcs_rank)")
    .eq("team_id", teamId)
    .in("status", ["active", "released"]);

  const contracts = contractsRaw ?? [];
  const activeContracts = contracts.filter((c) => c.status === "active");
  const formerContracts = contracts.filter((c) => c.status === "released");

  // Get all rider IDs
  const allRiderIds = contracts.map((c) => c.rider_id);

  // Parallelize: XP data for this team's riders + league teams list
  const [{ data: teamXpRaw }, { data: leagueTeamsRaw }] = await Promise.all([
    supabase
      .from("rider_xp_daily")
      .select("rider_id, xp_gained, race_slug")
      .eq("team_id", teamId),
    supabase
      .from("teams")
      .select("id")
      .eq("league_id", leagueId),
  ]);

  const riderXpTotal: Record<string, number> = {};
  for (const r of teamXpRaw ?? []) {
    riderXpTotal[r.rider_id] = (riderXpTotal[r.rider_id] ?? 0) + (r.xp_gained ?? 0);
  }

  // Per-rider ranking in league: need all league riders' XP from rider_xp_daily
  const leagueTeamIds = (leagueTeamsRaw ?? []).map((t) => t.id);

  const [{ data: leagueContractsRaw }, { data: leagueXpRaw }] = await Promise.all([
    supabase
      .from("contracts")
      .select("rider_id, status, released_at")
      .in("team_id", leagueTeamIds.length > 0 ? leagueTeamIds : ["__none__"])
      .in("status", ["active", "released"]),
    supabase
      .from("rider_xp_daily")
      .select("rider_id, xp_gained, race_slug")
      .in("team_id", leagueTeamIds.length > 0 ? leagueTeamIds : ["__none__"]),
  ]);

  // Deduplicate: active beats released; latest released_at wins among released
  const leagueContractByRider = new Map<string, { rider_id: string; status: string; released_at?: string | null }>();
  for (const c of leagueContractsRaw ?? []) {
    const existing = leagueContractByRider.get(c.rider_id);
    if (!existing) {
      leagueContractByRider.set(c.rider_id, c);
    } else if (c.status === "active" && existing.status !== "active") {
      leagueContractByRider.set(c.rider_id, c);
    } else if (c.status === "released" && existing.status === "released") {
      const cTime = c.released_at ?? "";
      const eTime = existing.released_at ?? "";
      if (cTime > eTime) leagueContractByRider.set(c.rider_id, c);
    }
  }
  const leagueRiderIds = [...leagueContractByRider.keys()];

  const leagueRiderXp: Record<string, number> = {};
  for (const r of leagueXpRaw ?? []) {
    leagueRiderXp[r.rider_id] = (leagueRiderXp[r.rider_id] ?? 0) + (r.xp_gained ?? 0);
  }

  // Sort league riders by XP to compute rankings
  const sortedLeagueRiders = leagueRiderIds
    .map((id) => ({ id, xp: leagueRiderXp[id] ?? 0 }))
    .sort((a, b) => b.xp - a.xp);

  const riderGameRank: Record<string, number> = {};
  sortedLeagueRiders.forEach((r, i) => { riderGameRank[r.id] = i + 1; });

  // Movement — compute from latest race using rider_xp_daily
  const allRaceSlugs = [...new Set((teamXpRaw ?? []).map((x) => x.race_slug).filter(Boolean))];
  // Find latest race slug by checking race_results dates
  const { data: latestRaceMeta } = allRaceSlugs.length > 0
    ? await supabase
        .from("race_results")
        .select("race_slug, race_date")
        .in("race_slug", allRaceSlugs)
        .order("race_date", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const riderMovement: Record<string, number> = {};
  if (latestRaceMeta) {
    // XP from the latest race per rider (from rider_xp_daily)
    const latestXp: Record<string, number> = {};
    for (const r of leagueXpRaw ?? []) {
      if (r.race_slug === latestRaceMeta.race_slug) {
        latestXp[r.rider_id] = (latestXp[r.rider_id] ?? 0) + (r.xp_gained ?? 0);
      }
    }

    // Previous ranking (total XP minus latest race)
    const prevSorted = leagueRiderIds
      .map((id) => ({ id, xp: (leagueRiderXp[id] ?? 0) - (latestXp[id] ?? 0) }))
      .sort((a, b) => b.xp - a.xp);

    const prevRankMap: Record<string, number> = {};
    prevSorted.forEach((r, i) => { prevRankMap[r.id] = i + 1; });

    for (const id of allRiderIds) {
      const cur = riderGameRank[id] ?? 0;
      const prev = prevRankMap[id] ?? cur;
      riderMovement[id] = prev - cur;
    }
  }

  function renderRiderRow(
    contract: typeof contracts[number],
    options: { isFormer?: boolean } = {},
  ) {
    const rider = Array.isArray(contract.riders) ? contract.riders[0] : contract.riders;
    const r = rider as { id: string; full_name: string; nationality: string | null; photo_url: string | null; pcs_rank: number | null };
    const xp = riderXpTotal[contract.rider_id] ?? 0;
    const rank = riderGameRank[contract.rider_id];
    const movement = riderMovement[contract.rider_id] ?? 0;

    return (
      <Link
        key={contract.id}
        href={`/league/${leagueId}/rider/${r.id}?from=ranking`}
        className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-surface-hover)] ${
          options.isFormer ? "opacity-50" : ""
        }`}
      >
        {/* Avatar */}
        <Avatar className={`size-9 shrink-0 ${options.isFormer ? "border border-dashed border-[var(--border-default)]" : ""}`}>
          {r.photo_url && (
            <AvatarImage
              src={resolvePhoto(r.photo_url)}
              alt={r.full_name}
              referrerPolicy="no-referrer"
            />
          )}
          <AvatarFallback className="bg-[var(--bg-surface)] border border-[var(--border-default)] text-[length:var(--type-micro)] text-[var(--text-mid)]">
            {getInitials(r.full_name)}
          </AvatarFallback>
        </Avatar>

        {/* Name + rank subtitle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)] truncate">
              {r.full_name}
            </span>
            {r.nationality && (
              <span className="shrink-0 text-[length:var(--type-caption)]">
                {countryCodeToFlag(r.nationality)}
              </span>
            )}
            {!options.isFormer && <MovementTag movement={movement} />}
          </div>
          {rank && (
            <span className="font-mono text-[length:var(--type-caption)] text-[var(--text-low)]">
              #{rank} in game
            </span>
          )}
        </div>

        {/* XP */}
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="font-mono text-[length:var(--type-emphasis)] font-bold text-[var(--text-high)]">
            {formatThousands(xp)}
          </span>
          <span className="text-[length:var(--type-micro)] text-[var(--text-low)]">
            XP
          </span>
        </div>

        {/* Chevron */}
        <ChevronRight size={16} className="shrink-0 text-[var(--text-ghost)]" />
      </Link>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <BackHeader label="Ranking" />

      {/* Team hero */}
      <div className="px-4 space-y-1">
        <h1 className="text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
          {team.name}
        </h1>
        <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
          Managed by @{ownerDisplayName}
        </p>
      </div>

      {/* 3 stat boxes */}
      <div className="flex gap-2 px-4">
        <MetricBox value={formatThousands(team.cumulative_xp)} label="Season XP" highlight />
        <MetricBox value={`${rankPosition}${ordinalSuffix(rankPosition)}`} label="Ranking" />
        <MetricBox value={getLevelForXp(team.cumulative_xp)} label="Level" />
      </div>

      {/* Active Roster */}
      <div>
        <div className="flex items-baseline justify-between px-4 pb-2">
          <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
            Active Roster
          </span>
          <span className="text-[length:var(--type-caption)] text-[var(--text-ghost)]">
            {activeContracts.length} rider{activeContracts.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {activeContracts.map((c) => renderRiderRow(c))}
        </div>

        {activeContracts.length === 0 && (
          <p className="px-4 text-[length:var(--type-body)] text-[var(--text-mid)]">
            No active riders.
          </p>
        )}
      </div>

      {/* Divider */}
      {formerContracts.length > 0 && (
        <>
          <div className="h-1.5 bg-[var(--bg-subtle)]" />

          {/* Former Riders */}
          <div>
            <div className="flex items-baseline justify-between px-4 pb-2">
              <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
                Former Riders
              </span>
              <span className="text-[length:var(--type-caption)] text-[var(--text-ghost)]">
                {formerContracts.length} rider{formerContracts.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="divide-y divide-[var(--border-subtle)]">
              {formerContracts.map((c) => renderRiderRow(c, { isFormer: true }))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
