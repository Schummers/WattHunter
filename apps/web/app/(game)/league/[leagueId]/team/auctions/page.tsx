import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { getLevelForXp, getMaxSlots } from "@/lib/levels";
import { getMaxActivePolicies, POLICY_TYPES } from "@/lib/policies";
import { calcMinSalary, countryCodeToFlag } from "@/lib/format";
import { calculateBoost, riderMatchesPolicy } from "@/lib/boost";
import { AuctionsClient } from "./auctions-client";

function formatName(fullName: string): string {
  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length <= 1) return fullName;
  const lastName = parts[parts.length - 1];
  const firstInitial = parts[0][0].toUpperCase();
  return `${firstInitial}. ${lastName}`;
}

export default async function AuctionsPage({
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
          Please sign in to view your auctions.
        </p>
      </div>
    );
  }

  // Get member + team
  const { data: member } = await supabase
    .from("league_members")
    .select("id, team_id, teams:team_id(id, name, cumulative_xp, level, treasury)")
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
  const maxSlots = getMaxSlots(level);
  const maxActivePolicies = getMaxActivePolicies(level);

  // Parallel queries
  const [
    { data: auctionRounds },
    { data: activeContracts },
    { data: draftBids },
    { data: activePolicies },
    { data: teamSponsor },
  ] = await Promise.all([
    supabase
      .from("auctions")
      .select("id, round, opens_at, closes_at, status")
      .eq("league_id", leagueId)
      .order("round", { ascending: true }),
    supabase
      .from("contracts")
      .select(
        "id, rider_id, locked_salary, status, riders(id, full_name, nationality, real_team, pcs_rank, pcs_rank_prev, photo_url, specialty, pcs_points_1yr, birthdate)"
      )
      .eq("team_id", team?.id)
      .eq("status", "active"),
    supabase
      .from("draft_bids")
      .select(
        "id, rider_id, amount, riders(id, full_name, nationality, real_team, pcs_rank, pcs_rank_prev, photo_url, specialty, pcs_points_1yr, birthdate)"
      )
      .eq("team_id", team?.id)
      .eq("league_id", leagueId),
    supabase
      .from("team_policies")
      .select("policy_id, config, policies:policy_id(slug, xp_bonus)")
      .eq("team_id", team?.id)
      .eq("is_active", true),
    supabase
      .from("team_sponsors")
      .select("sponsor_id, sponsors(id, name, monthly_budget)")
      .eq("team_id", team?.id)
      .single(),
  ]);

  // Rider XP data
  const rosterRiderIds = (activeContracts ?? []).map((c) => c.rider_id);
  const { data: xpData } =
    rosterRiderIds.length > 0
      ? await supabase
          .from("rider_xp_daily")
          .select("rider_id, xp_gained")
          .eq("team_id", team?.id)
          .in("rider_id", rosterRiderIds)
      : { data: [] as { rider_id: string; xp_gained: number }[] };

  // Build XP map
  const xpByRider: Record<string, number> = {};
  for (const row of xpData ?? []) {
    xpByRider[row.rider_id] = (xpByRider[row.rider_id] ?? 0) + row.xp_gained;
  }

  // Build boost policies
  const boostPolicies = (activePolicies ?? []).map((tp) => {
    const p = Array.isArray(tp.policies) ? tp.policies[0] : tp.policies;
    return {
      slug: (p as { slug: string })?.slug ?? "",
      xp_bonus: (p as { xp_bonus: number })?.xp_bonus ?? 0,
      config: tp.config as Record<string, string> | null,
    };
  });

  // Per-rider boost calculation
  const riderBoosts: Record<string, number> = {};
  for (const tr of activeContracts ?? []) {
    const r = Array.isArray(tr.riders) ? tr.riders[0] : tr.riders;
    if (!r) continue;
    const riderData = {
      nationality: r.nationality ?? null,
      real_team: r.real_team ?? null,
      specialty: r.specialty ?? null,
      birthdate: (r as { birthdate?: string | null })?.birthdate ?? null,
    };
    const matchCount = boostPolicies.filter((p) => riderMatchesPolicy(riderData, p)).length;
    if (matchCount > 0) {
      riderBoosts[r.id] = matchCount * 5;
    }
  }

  // Draft rider boosts
  const draftBoosts: Record<string, number> = {};
  for (const db of draftBids ?? []) {
    const r = Array.isArray(db.riders) ? db.riders[0] : db.riders;
    if (!r) continue;
    const riderData = {
      nationality: r.nationality ?? null,
      real_team: r.real_team ?? null,
      specialty: r.specialty ?? null,
      birthdate: (r as { birthdate?: string | null })?.birthdate ?? null,
    };
    const matchCount = boostPolicies.filter((p) => riderMatchesPolicy(riderData, p)).length;
    if (matchCount > 0) {
      draftBoosts[r.id] = matchCount * 5;
    }
  }

  // Active policies for display
  const activePoliciesDisplay = boostPolicies.map((bp) => {
    const policyType = POLICY_TYPES.find((pt) => pt.slug === bp.slug);
    if (!policyType) return null;
    const configValue = bp.config?.[policyType.paramKey] ?? null;
    const rosterRiders = (activeContracts ?? []).map((tr) => {
      const r = Array.isArray(tr.riders) ? tr.riders[0] : tr.riders;
      return {
        nationality: r?.nationality ?? null,
        real_team: r?.real_team ?? null,
        specialty: r?.specialty ?? null,
        birthdate: (r as { birthdate?: string | null } | null | undefined)?.birthdate ?? null,
      };
    });
    const matchCount = rosterRiders.filter((r) => riderMatchesPolicy(r, bp)).length;
    return {
      slug: bp.slug,
      name: configValue ? `${policyType.name}: ${configValue}` : policyType.name,
      boostPct: matchCount * 5,
    };
  }).filter((p): p is { slug: string; name: string; boostPct: number } => p !== null);

  // Sponsor data
  const rawSponsor = teamSponsor?.sponsors;
  const sponsorData = Array.isArray(rawSponsor) ? rawSponsor[0] : rawSponsor;
  const sponsorName = (sponsorData as { name: string } | null | undefined)?.name ?? "Lotto (default)";
  const sponsorBudget = (sponsorData as { monthly_budget: number } | null | undefined)?.monthly_budget ?? 250_000;

  // Active round
  const openRound = (auctionRounds ?? []).find((r) => r.status === "open");
  const activeRoundNumber = openRound?.round ?? null;
  const isRound1 = activeRoundNumber === 1;

  // Build roster riders for client
  const rosterRiders = (activeContracts ?? []).map((tr) => {
    const r = Array.isArray(tr.riders) ? tr.riders[0] : tr.riders;
    if (!r) return null;
    return {
      contractId: tr.id,
      riderId: r.id,
      name: formatName(r.full_name),
      nationality_flag: r.nationality ? countryCodeToFlag(r.nationality) : undefined,
      team_name: r.real_team ?? undefined,
      pcs_rank: r.pcs_rank ?? undefined,
      pcs_rank_prev: (r as { pcs_rank_prev?: number | null }).pcs_rank_prev ?? undefined,
      photo_url: r.photo_url ?? null,
      specialty: r.specialty ?? undefined,
      lockedSalary: tr.locked_salary ?? 0,
      xp: xpByRider[r.id] ?? 0,
      boostPct: riderBoosts[r.id] ?? 0,
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  // Build draft bids for client
  const drafts = (draftBids ?? []).map((db) => {
    const r = Array.isArray(db.riders) ? db.riders[0] : db.riders;
    if (!r) return null;
    const pcsPoints = (r as { pcs_points_1yr?: number | null }).pcs_points_1yr ?? 0;
    return {
      riderId: r.id,
      name: formatName(r.full_name),
      nationality: r.nationality ?? undefined,
      team_name: r.real_team ?? undefined,
      pcs_rank: r.pcs_rank ?? undefined,
      pcs_rank_prev: (r as { pcs_rank_prev?: number | null }).pcs_rank_prev ?? undefined,
      photo_url: r.photo_url ?? null,
      specialty: r.specialty ?? undefined,
      amount: db.amount,
      minSalary: calcMinSalary(pcsPoints),
      boostPct: draftBoosts[r.id] ?? 0,
    };
  }).filter((d): d is NonNullable<typeof d> => d !== null);

  return (
    <AuctionsClient
      leagueId={leagueId}
      rounds={(auctionRounds ?? []).map((r) => ({
        id: r.id,
        round: r.round,
        opens_at: r.opens_at,
        closes_at: r.closes_at,
        status: r.status,
      }))}
      activeRound={activeRoundNumber}
      isRound1={isRound1}
      sponsorName={sponsorName}
      sponsorBudget={sponsorBudget}
      activePolicies={activePoliciesDisplay}
      maxPolicies={maxActivePolicies}
      rosterRiders={rosterRiders}
      drafts={drafts}
      maxSlots={maxSlots}
    />
  );
}
