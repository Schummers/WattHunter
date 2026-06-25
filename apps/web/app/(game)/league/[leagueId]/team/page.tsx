import { redirect } from "next/navigation";
import { ChevronRight, Target, Globe, Users, Clock } from "lucide-react";
import { RailLink } from "@/components/rail-link";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { isClassic } from "@/lib/league-mode";
import { RiderCard } from "@/components/rider-card";
import { BrandCard } from "@/components/brand-card";
import { Badge } from "@/components/ui/badge";
import { getMaxSlots, getProgressPct, getNextLevel } from "@/lib/levels";
import { countryCodeToFlag } from "@/lib/format";
import { riderMatchesStrategy } from "@/lib/boost";
import { STRATEGY_TYPES, getMaxActiveStrategies } from "@/lib/strategies";
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";


const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Target,
  Globe,
  Users,
  Clock,
};

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

  if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoTeam();

  const supabase = await createClient();

  const user = await getUser();

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
    .select("id, team_id, teams:team_id(id, name, cumulative_xp, level), leagues:league_id(mode)")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  // Classic mode has no "My Team" page (no levels/strategies/roster) — the team view is the
  // Grand Tour squad builder. Send classic users straight there.
  const leagueRow = member
    ? (Array.isArray(member.leagues) ? member.leagues[0] : member.leagues)
    : null;
  if (member && isClassic((leagueRow?.mode ?? "manager") as "manager" | "classic")) {
    redirect(`/league/${leagueId}/team/gt`);
  }

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

  // Group 1: parallel queries — all depend only on team.id / leagueId
  const xp = team?.cumulative_xp ?? 0;
  const [
    { data: teamRiders },
    { count: teamsAbove },
    { count: totalTeams },
    { data: activeStrategies },
  ] = await Promise.all([
    supabase
      .from("contracts")
      .select(
        "id, rider_id, locked_salary, status, riders(id, full_name, nationality, real_team, pcs_rank, photo_url, specialty, pcs_points_1yr, birthdate)"
      )
      .eq("team_id", team?.id)
      .eq("status", "active"),
    supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .gt("cumulative_xp", xp),
    supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId),
    supabase
      .from("team_strategies")
      .select("strategy_id, config, strategies:strategy_id(slug, xp_bonus)")
      .eq("team_id", team?.id)
      .eq("is_active", true),
  ]);

  const riderIds = (teamRiders ?? []).map((tr) => tr.rider_id);

  // Group 2: parallel queries — depend on Group 1 results
  const [{ data: xpData }] = await Promise.all([
    riderIds.length > 0
      ? supabase
          .from("rider_xp_daily")
          .select("rider_id, xp_gained")
          .eq("team_id", team?.id)
          .in("rider_id", riderIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const rank = (teamsAbove ?? 0) + 1;
  const teamCount = totalTeams ?? 0;
  const level = team?.level ?? 1;
  const maxSlots = getMaxSlots(level);
  const riderCount = teamRiders?.length ?? 0;

  const boostStrategies = (activeStrategies ?? []).map((tp) => {
    const p = Array.isArray(tp.strategies) ? tp.strategies[0] : tp.strategies;
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
      birthdate: (r as { birthdate?: string | null })?.birthdate ?? null,
    };
  });

  // Per-rider boost calculation
  const riderBoosts: Record<string, number> = {};
  if (teamRiders) {
    for (const tr of teamRiders) {
      const r = Array.isArray(tr.riders) ? tr.riders[0] : tr.riders;
      if (!r) continue;
      const riderData = {
        nationality: r.nationality ?? null,
        real_team: r.real_team ?? null,
        specialty: r.specialty ?? null,
        birthdate: (r as { birthdate?: string | null })?.birthdate ?? null,
      };
      const matchCount = boostStrategies.filter((p) =>
        riderMatchesStrategy(riderData, p)
      ).length;
      if (matchCount > 0) {
        riderBoosts[r.id] = matchCount * 5;
      }
    }
  }

  const xpByRider: Record<string, number> = {};
  for (const row of xpData ?? []) {
    xpByRider[row.rider_id] = (xpByRider[row.rider_id] ?? 0) + row.xp_gained;
  }

  // Level progress
  const progressPct = getProgressPct(xp, level);
  const nextLevel = getNextLevel(level);
  const isMaxLevel = !nextLevel;

  // Strategy slots data
  const maxActiveStrategies = getMaxActiveStrategies(level);
  const activeStrategySlots = boostStrategies.map((bp) => {
    const strategyType = STRATEGY_TYPES.find((pt) => pt.slug === bp.slug);
    if (!strategyType) return null;
    const configValue = bp.config?.[strategyType.paramKey] ?? null;
    return {
      slug: bp.slug,
      icon: strategyType.icon,
      name: strategyType.name,
      value: configValue,
      boostPct: boostStrategies.length > 0
        ? boostRiders.filter((r) => riderMatchesStrategy(r, bp)).length * 5
        : 0,
    };
  }).filter(Boolean);

  return (
    <div className="py-4 space-y-6">
      {/* MT-2: Branded XP Hero Card */}
      <div className="px-4">
        <RailLink href={`/league/${leagueId}/levels`}>
          <BrandCard
            xp={xp}
            level={level}
            progressPct={progressPct}
            rank={rank}
            teamCount={teamCount}
            nextLevelXp={isMaxLevel ? null : nextLevel.xp}
            isMaxLevel={isMaxLevel}
          />
        </RailLink>
      </div>

      {/* MT-3: Strategy Slots Section */}
      <div>
        <div className="flex items-center justify-between px-4 mb-2">
          <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Strategies
          </span>
          <RailLink
            href={`/league/${leagueId}/team/strategies`}
            className="text-[length:var(--type-body)] link-tertiary"
          >
            See all &rarr;
          </RailLink>
        </div>

        <div>
          {/* Active strategy slots */}
          {activeStrategySlots.map((slot) => {
            const IconComp = ICON_MAP[slot!.icon];
            return (
              <RailLink
                key={slot!.slug}
                href={`/league/${leagueId}/team/strategies`}
              >
                <div className="relative flex items-center gap-3 px-4 py-3 after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-[var(--border-subtle)] hover:bg-[var(--bg-subtle)] transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface)]">
                    {IconComp && <IconComp size={16} className="text-[var(--text-high)]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[length:var(--type-caption)] text-[var(--text-mid)]">
                      {slot!.name}
                    </span>
                    <span className="block text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                      {slot!.value ?? "Any"}
                    </span>
                  </div>
                  {slot!.boostPct > 0 && (
                    <Badge variant="highlighted" className="shrink-0 font-mono tabular-nums text-[var(--accent-highlight)]">
                      +{slot!.boostPct}%
                    </Badge>
                  )}
                  <ChevronRight size={14} className="shrink-0 text-[var(--text-ghost)]" />
                </div>
              </RailLink>
            );
          })}

          {/* Empty slots (unlocked but inactive) */}
          {Array.from({ length: Math.max(0, maxActiveStrategies - activeStrategySlots.length) }).map((_, i) => (
            <RailLink
              key={`empty-${i}`}
              href={`/league/${leagueId}/team/strategies`}
            >
              <div className="relative flex items-center gap-3 px-4 py-3 after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-[var(--border-subtle)] hover:bg-[var(--bg-subtle)] transition-colors">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border-default)]">
                  <span className="text-[length:var(--type-body)] text-[var(--text-ghost)]">+</span>
                </div>
                <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-ghost)]">
                  Open slot
                </span>
                <ChevronRight size={14} className="shrink-0 text-[var(--text-ghost)] ml-auto" />
              </div>
            </RailLink>
          ))}
        </div>
      </div>

      {/* Roster */}
      <div>
        <div className="flex items-center justify-between px-4 mb-2">
          <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Roster
          </span>
          <span className="text-[length:var(--type-caption)] font-semibold text-[var(--text-low)]">
            <span className="font-mono tabular-nums">{riderCount}/{maxSlots}</span> slots
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
                xp={xpByRider[r.id] ?? 0}
                boostPct={riderBoosts[r.id] ?? 0}
                href={`/league/${leagueId}/rider/${r.id}?from=team`}
              />
            );
          })}

          {/* Open slots */}
          {Array.from({ length: maxSlots - riderCount }).map((_, i) => (
            <RiderCard
              key={`open-${i}`}
              rider={{ id: "", name: "" }}
              isOpenSlot
              href={`/league/${leagueId}/auction/market`}
            />
          ))}
        </div>
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Demo path — anonymous visitor, no auth required
// ---------------------------------------------------------------------------
async function renderDemoTeam() {
  const supabase = await createClient();
  const teamId = DEMO_VISITOR_TEAM_ID;
  const leagueId = DEMO_LEAGUE_ID;

  const [
    { data: teamRiders },
    { count: teamsAbove },
    { count: totalTeams },
    { data: activeStrategies },
  ] = await Promise.all([
    supabase
      .from("contracts")
      .select(
        "id, rider_id, locked_salary, status, riders(id, full_name, nationality, real_team, pcs_rank, photo_url, specialty, pcs_points_1yr, birthdate)"
      )
      .eq("team_id", teamId)
      .eq("status", "active"),
    supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .gt("cumulative_xp", (
        await supabase
          .from("teams")
          .select("cumulative_xp")
          .eq("id", teamId)
          .single()
      ).data?.cumulative_xp ?? 0),
    supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId),
    supabase
      .from("team_strategies")
      .select("strategy_id, config, strategies:strategy_id(slug, xp_bonus)")
      .eq("team_id", teamId)
      .eq("is_active", true),
  ]);

  // Fetch team row to get xp + level
  const { data: teamRow } = await supabase
    .from("teams")
    .select("id, name, cumulative_xp, level")
    .eq("id", teamId)
    .single();

  const xp = teamRow?.cumulative_xp ?? 0;
  const level = teamRow?.level ?? 1;
  const riderIds = (teamRiders ?? []).map((tr) => tr.rider_id);

  const [{ data: xpData }] = await Promise.all([
    riderIds.length > 0
      ? supabase
          .from("rider_xp_daily")
          .select("rider_id, xp_gained")
          .eq("team_id", teamId)
          .in("rider_id", riderIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const rank = (teamsAbove ?? 0) + 1;
  const teamCount = totalTeams ?? 0;
  const maxSlots = getMaxSlots(level);
  const riderCount = teamRiders?.length ?? 0;

  const boostStrategies = (activeStrategies ?? []).map((tp) => {
    const p = Array.isArray(tp.strategies) ? tp.strategies[0] : tp.strategies;
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
      birthdate: (r as { birthdate?: string | null })?.birthdate ?? null,
    };
  });

  const riderBoosts: Record<string, number> = {};
  if (teamRiders) {
    for (const tr of teamRiders) {
      const r = Array.isArray(tr.riders) ? tr.riders[0] : tr.riders;
      if (!r) continue;
      const riderData = {
        nationality: r.nationality ?? null,
        real_team: r.real_team ?? null,
        specialty: r.specialty ?? null,
        birthdate: (r as { birthdate?: string | null })?.birthdate ?? null,
      };
      const matchCount = boostStrategies.filter((p) =>
        riderMatchesStrategy(riderData, p)
      ).length;
      if (matchCount > 0) riderBoosts[r.id] = matchCount * 5;
    }
  }

  const xpByRider: Record<string, number> = {};
  for (const row of xpData ?? []) {
    xpByRider[row.rider_id] = (xpByRider[row.rider_id] ?? 0) + row.xp_gained;
  }

  const progressPct = getProgressPct(xp, level);
  const nextLevel = getNextLevel(level);
  const isMaxLevel = !nextLevel;
  const maxActiveStrategies = getMaxActiveStrategies(level);
  const activeStrategySlots = boostStrategies.map((bp) => {
    const strategyType = STRATEGY_TYPES.find((pt) => pt.slug === bp.slug);
    if (!strategyType) return null;
    const configValue = bp.config?.[strategyType.paramKey] ?? null;
    return {
      slug: bp.slug,
      icon: strategyType.icon,
      name: strategyType.name,
      value: configValue,
      boostPct: boostRiders.filter((r) => riderMatchesStrategy(r, bp)).length * 5,
    };
  }).filter(Boolean);

  return (
    <div className="py-4 space-y-6">
      <div className="px-4">
        <RailLink href={`/league/${DEMO_LEAGUE_SLUG}/levels`}>
          <BrandCard
            xp={xp}
            level={level}
            progressPct={progressPct}
            rank={rank}
            teamCount={teamCount}
            nextLevelXp={isMaxLevel ? null : nextLevel!.xp}
            isMaxLevel={isMaxLevel}
          />
        </RailLink>
      </div>

      <div>
        <div className="flex items-center justify-between px-4 mb-2">
          <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Strategies
          </span>
          <RailLink
            href={`/league/${DEMO_LEAGUE_SLUG}/team/strategies`}
            className="text-[length:var(--type-body)] link-tertiary"
          >
            See all &rarr;
          </RailLink>
        </div>

        <div>
          {activeStrategySlots.map((slot) => {
            const IconComp = ICON_MAP[slot!.icon];
            return (
              <RailLink
                key={slot!.slug}
                href={`/league/${DEMO_LEAGUE_SLUG}/team/strategies`}
              >
                <div className="relative flex items-center gap-3 px-4 py-3 after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-[var(--border-subtle)] hover:bg-[var(--bg-subtle)] transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface)]">
                    {IconComp && <IconComp size={16} className="text-[var(--text-high)]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[length:var(--type-caption)] text-[var(--text-mid)]">
                      {slot!.name}
                    </span>
                    <span className="block text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                      {slot!.value ?? "Any"}
                    </span>
                  </div>
                  {slot!.boostPct > 0 && (
                    <Badge variant="highlighted" className="shrink-0 font-mono tabular-nums text-[var(--accent-highlight)]">
                      +{slot!.boostPct}%
                    </Badge>
                  )}
                  <ChevronRight size={14} className="shrink-0 text-[var(--text-ghost)]" />
                </div>
              </RailLink>
            );
          })}

          {Array.from({ length: Math.max(0, maxActiveStrategies - activeStrategySlots.length) }).map((_, i) => (
            <RailLink
              key={`empty-${i}`}
              href={`/league/${DEMO_LEAGUE_SLUG}/team/strategies`}
            >
              <div className="relative flex items-center gap-3 px-4 py-3 after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-[var(--border-subtle)] hover:bg-[var(--bg-subtle)] transition-colors">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border-default)]">
                  <span className="text-[length:var(--type-body)] text-[var(--text-ghost)]">+</span>
                </div>
                <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-ghost)]">
                  Open slot
                </span>
                <ChevronRight size={14} className="shrink-0 text-[var(--text-ghost)] ml-auto" />
              </div>
            </RailLink>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between px-4 mb-2">
          <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Roster
          </span>
          <span className="text-[length:var(--type-caption)] font-semibold text-[var(--text-low)]">
            <span className="font-mono tabular-nums">{riderCount}/{maxSlots}</span> slots
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
                xp={xpByRider[r.id] ?? 0}
                boostPct={riderBoosts[r.id] ?? 0}
                href={`/league/${DEMO_LEAGUE_SLUG}/rider/${r.id}?from=team`}
              />
            );
          })}

          {Array.from({ length: maxSlots - riderCount }).map((_, i) => (
            <RiderCard
              key={`open-${i}`}
              rider={{ id: "", name: "" }}
              isOpenSlot
              href={`/league/${DEMO_LEAGUE_SLUG}/auction/market`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
