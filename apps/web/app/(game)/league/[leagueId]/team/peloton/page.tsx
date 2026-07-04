import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { getCurrentGTPhase } from "@/lib/gt-phases";
import { formatXp } from "@/lib/format";
import { gtRoleLabel, type GtRole } from "@/lib/gt-roles";
import { resolvePhotoUrl } from "@/lib/photo-url";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

interface RiderRow {
  id: string;
  full_name: string | null;
  nationality: string | null;
  photo_url: string | null;
  pcs_rank: number | null;
}

type ContractRow = {
  team_id: string;
  rider_id: string;
  riders: RiderRow | RiderRow[] | null;
};

/** "Tadej Pogačar" -> "Pogačar"; single-word names pass through. */
function lastName(fullName: string | null): string {
  if (!fullName) return "—";
  const parts = fullName.split(" ").filter(Boolean);
  return parts.length <= 1 ? fullName : parts[parts.length - 1];
}

function initials(fullName: string | null): string {
  if (!fullName) return "?";
  const parts = fullName.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function firstOrNull(r: RiderRow | RiderRow[] | null): RiderRow | null {
  if (!r) return null;
  return Array.isArray(r) ? (r[0] ?? null) : r;
}

export default async function PelotonPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const isDemo = leagueId === DEMO_LEAGUE_SLUG;

  const supabase = await createClient();

  let myTeamId: string | null = null;
  let effectiveLeagueId = leagueId;

  if (isDemo) {
    effectiveLeagueId = DEMO_LEAGUE_ID;
    myTeamId = DEMO_VISITOR_TEAM_ID;
  } else {
    const user = await getUser();
    if (!user) redirect("/login");

    const { data: member } = await supabase
      .from("league_members")
      .select("team_id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .maybeSingle();

    myTeamId = member?.team_id ?? null;
  }

  // All teams in the league, ordered by cumulative XP (strongest first).
  const { data: teamsRaw } = await supabase
    .from("teams")
    .select("id, name, cumulative_xp, level")
    .eq("league_id", effectiveLeagueId)
    .order("cumulative_xp", { ascending: false });

  const teams = teamsRaw ?? [];
  const teamIds = teams.map((t) => t.id);
  const scopedIds = teamIds.length > 0 ? teamIds : ["__none__"];

  // Active rosters + current-race tactical roles (roles only exist during a GT).
  const phase = getCurrentGTPhase();
  const year = new Date().getFullYear();

  const [{ data: contractsRaw }, { data: squadRaw }] = await Promise.all([
    supabase
      .from("contracts")
      .select("team_id, rider_id, riders:rider_id(id, full_name, nationality, photo_url, pcs_rank)")
      .in("team_id", scopedIds)
      .eq("status", "active"),
    phase
      ? supabase
          .from("gt_squad")
          .select("team_id, rider_id, role")
          .in("team_id", scopedIds)
          .eq("phase_id", phase.id)
          .eq("year", year)
          .is("removed_at", null)
      : Promise.resolve({ data: [] as Array<{ team_id: string; rider_id: string; role: GtRole }> }),
  ]);

  const roleByTeamRider = new Map<string, GtRole>();
  for (const s of (squadRaw ?? []) as Array<{ team_id: string; rider_id: string; role: GtRole }>) {
    roleByTeamRider.set(`${s.team_id}:${s.rider_id}`, s.role);
  }

  // Group riders by team, best PCS rank first.
  const ridersByTeam = new Map<string, RiderRow[]>();
  for (const c of (contractsRaw ?? []) as ContractRow[]) {
    const rider = firstOrNull(c.riders);
    if (!rider) continue;
    const list = ridersByTeam.get(c.team_id) ?? [];
    list.push(rider);
    ridersByTeam.set(c.team_id, list);
  }
  for (const list of ridersByTeam.values()) {
    list.sort((a, b) => (a.pcs_rank ?? 9999) - (b.pcs_rank ?? 9999));
  }

  return (
    <div className="flex flex-col gap-4 pt-2 pb-8">
      {teams.map((team) => {
        const riders = ridersByTeam.get(team.id) ?? [];
        const isMe = team.id === myTeamId;

        return (
          <section key={team.id}>
            {/* Team header */}
            <div className="flex items-center justify-between gap-3 px-4 py-2">
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)] truncate">
                  {team.name}
                </span>
                {isMe && (
                  <span className="shrink-0 rounded-[var(--radius-lg)] bg-[var(--accent-subtle-bg)] px-1.5 text-[length:var(--type-micro)] font-medium text-[var(--accent-label)]">
                    You
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[length:var(--type-caption)] font-mono tabular-nums text-[var(--text-mid)]">
                {formatXp(team.cumulative_xp ?? 0)} XP
              </span>
            </div>

            {/* Rider grid: 2 columns, separators between cells */}
            {riders.length === 0 ? (
              <div className="px-4 pb-3 text-[length:var(--type-caption)] text-[var(--text-low)]">
                No riders yet.
              </div>
            ) : (
              <div className="grid grid-cols-2">
                {riders.map((rider, i) => {
                  const role = roleByTeamRider.get(`${team.id}:${rider.id}`) ?? null;
                  const roleLabel = gtRoleLabel(role);
                  return (
                    <div
                      key={rider.id}
                      className={`flex items-center gap-2.5 px-4 py-2 border-t border-[var(--border-subtle)] ${
                        i % 2 === 0 ? "border-r" : ""
                      }`}
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        {rider.photo_url && (
                          <AvatarImage
                            src={resolvePhotoUrl(rider.photo_url)}
                            alt={rider.full_name ?? ""}
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <AvatarFallback className="bg-[var(--bg-app)] text-[length:var(--type-micro)] text-[var(--text-mid)]">
                          {initials(rider.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex flex-col min-w-0">
                        <span className="text-[length:var(--type-caption)] font-medium text-[var(--text-high)] truncate">
                          {lastName(rider.full_name)}
                        </span>
                        <span className="text-[length:var(--type-micro)] text-[var(--text-mid)] truncate">
                          {roleLabel ?? "—"}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {teams.length === 0 && (
        <div className="px-4 py-8 text-[length:var(--type-body)] text-[var(--text-mid)]">
          No teams in this league yet.
        </div>
      )}
    </div>
  );
}
