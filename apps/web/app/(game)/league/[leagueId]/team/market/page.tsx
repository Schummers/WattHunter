import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { MarketClient } from "./market-client";
import { PhaseSetup } from "./phase-setup";
import { getLevelByNumber, getMaxSlots, getLevelForXp } from "@/lib/levels";
import { getCurrentPhase, getPhaseRange, getNextAuctionDate, formatAuctionDate } from "@/lib/phases";

export default async function MarketPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return (
      <div className="px-4 py-8">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
          Please sign in to view the market.
        </p>
      </div>
    );
  }

  const { data: member } = await supabase
    .from("league_members")
    .select(
      "id, team_id, teams:team_id(id, level, cumulative_xp, treasury, phase_confirmed_id, pending_sponsor_id)"
    )
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
  const xp = team?.cumulative_xp ?? 0;
  const level = getLevelForXp(xp);
  const currentPhase = getCurrentPhase();
  const phaseConfirmed = team?.phase_confirmed_id === currentPhase.id;

  // ===== STATE 1: Phase Setup (not yet confirmed) =====
  if (!phaseConfirmed) {
    const [
      { data: teamSponsor },
      { data: contracts },
      { data: policies },
      { data: pendingSponsor },
      { data: auctions },
      { data: leagueInfo },
    ] = await Promise.all([
      supabase
        .from("team_sponsors")
        .select("sponsor_id, sponsors(name, monthly_budget)")
        .eq("team_id", team?.id ?? "")
        .maybeSingle(),
      supabase
        .from("contracts")
        .select("id, rider_id, locked_salary, riders:rider_id(full_name)")
        .eq("team_id", team?.id ?? "")
        .eq("status", "active"),
      supabase
        .from("team_policies")
        .select("id, is_active, config, policies:policy_id(name)")
        .eq("team_id", team?.id ?? "")
        .eq("is_active", true),
      team?.pending_sponsor_id
        ? supabase
            .from("sponsors")
            .select("name")
            .eq("id", team.pending_sponsor_id)
            .single()
        : Promise.resolve({ data: null }),
      supabase
        .from("auctions")
        .select("id, name, opens_at")
        .eq("league_id", leagueId)
        .in("status", ["scheduled", "open"])
        .order("opens_at", { ascending: true })
        .limit(3),
      supabase
        .from("leagues")
        .select("commissioner_id")
        .eq("id", leagueId)
        .single(),
    ]);

    const rawSponsor = teamSponsor?.sponsors;
    const sponsor = (Array.isArray(rawSponsor) ? rawSponsor[0] : rawSponsor) as { name: string; monthly_budget: number } | null;
    const { start: phaseStart } = getPhaseRange(currentPhase, new Date().getFullYear());
    const phaseStarted = new Date() >= phaseStart;

    const roster = (contracts ?? []).map((c) => {
      const rider = Array.isArray(c.riders) ? c.riders[0] : c.riders;
      return {
        contractId: c.id,
        riderId: c.rider_id,
        fullName: (rider as { full_name: string } | null)?.full_name ?? "Unknown",
        lockedSalary: c.locked_salary,
      };
    });

    const activePolicies = (policies ?? [])
      .filter((p) => p.is_active)
      .map((p) => {
        const policy = Array.isArray(p.policies) ? p.policies[0] : p.policies;
        return {
          id: p.id,
          name: (policy as { name: string } | null)?.name ?? "Unknown",
          config: p.config ? JSON.stringify(p.config) : "—",
        };
      });

    const rounds = (auctions ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      date: a.opens_at,
    }));

    const isCommissioner = leagueInfo?.commissioner_id === user.id;

    const levelData = getLevelByNumber(level);

    return (
      <PhaseSetup
        leagueId={leagueId}
        teamId={team?.id ?? ""}
        phase={{ id: currentPhase.id, label: currentPhase.label }}
        phaseStarted={phaseStarted}
        phaseStartDate={phaseStart.toISOString()}
        sponsor={sponsor ? { name: sponsor.name, monthlyBudget: sponsor.monthly_budget } : null}
        pendingSponsor={pendingSponsor as { name: string } | null}
        roster={roster}
        activePolicies={activePolicies}
        maxPolicies={levelData.maxActive}
        treasury={team?.treasury ?? 0}
        rounds={rounds}
        isCommissioner={isCommissioner}
      />
    );
  }

  // ===== STATE 2: Bidding (already confirmed) =====
  const minRank = getLevelByNumber(level).poolMin;

  const [{ data: riders }, { data: leagueTeams }] = await Promise.all([
    supabase
      .from("riders")
      .select(
        "id, full_name, nationality, real_team, pcs_rank, pcs_rank_prev, photo_url, specialty, pcs_points_1yr, birthdate"
      )
      .gte("pcs_rank", minRank)
      .lte("pcs_rank", 600)
      .order("pcs_rank", { ascending: true })
      .limit(600),
    supabase.from("teams").select("id").eq("league_id", leagueId),
  ]);

  const leagueTeamIds = (leagueTeams ?? []).map((t) => t.id);

  const { data: leagueContracts } = await supabase
    .from("contracts")
    .select("rider_id, team_id")
    .in("team_id", leagueTeamIds)
    .eq("status", "active");

  const ownedRiderIds = new Set(
    (leagueContracts ?? []).map((c) => c.rider_id)
  );

  const ownTeamSlots = (leagueContracts ?? []).filter(
    (c) => c.team_id === team?.id
  ).length;

  const availableRiders = (riders ?? [])
    .filter((r) => !ownedRiderIds.has(r.id))
    .map((r) => ({
      ...r,
      pcs_rank_diff:
        r.pcs_rank != null && r.pcs_rank_prev != null
          ? r.pcs_rank_prev - r.pcs_rank
          : null,
    }));

  const [
    { data: activeRound },
    { data: scheduledRoundData },
    { count: closedCount },
  ] = await Promise.all([
    supabase
      .from("auctions")
      .select("id, name, opens_at, closes_at")
      .eq("league_id", leagueId)
      .eq("status", "open")
      .order("opens_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("auctions")
      .select("id, name, opens_at")
      .eq("league_id", leagueId)
      .eq("status", "scheduled")
      .order("opens_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("auctions")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .eq("status", "closed"),
  ]);

  let nextRound: { id: string; name: string; opens_at: string } | null = null;
  let nextAuctionLabel: string | null = null;
  if (!activeRound) {
    nextRound = scheduledRoundData;
    if (!nextRound) {
      if (closedCount && closedCount > 0) {
        const next = getNextAuctionDate();
        if (next) {
          nextAuctionLabel = `Next round · ${formatAuctionDate(next.date)}`;
        }
      }
    }
  }

  let initialBids: Array<{ bid_id: string; rider_id: string; amount: number }> = [];
  if (activeRound && team?.id) {
    const { data: existingBids } = await supabase
      .from("auction_bids")
      .select("id, rider_id, amount")
      .eq("team_id", team.id)
      .eq("auction_id", activeRound.id)
      .eq("status", "active");

    initialBids = (existingBids ?? []).map((b) => ({
      bid_id: b.id,
      rider_id: b.rider_id,
      amount: b.amount,
    }));
  }

  return (
    <MarketClient
      leagueId={leagueId}
      riders={availableRiders}
      activeRound={activeRound}
      nextRound={nextRound}
      nextAuctionLabel={nextAuctionLabel}
      maxSlots={getMaxSlots(level)}
      currentSlots={ownTeamSlots}
      initialBids={initialBids}
      treasury={team?.treasury ?? 0}
    />
  );
}
