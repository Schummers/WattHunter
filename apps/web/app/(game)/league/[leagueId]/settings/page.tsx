import { createClient } from "@/lib/supabase/server";
import { BackHeader } from "@/components/back-header";
import {
  Trophy,
  Coins,
  Layers,
  Gavel,
  ChevronRight,
} from "lucide-react";
import {
  CopyInviteCodeButton,
  SignOutButton,
  EditableTeamName,
  LeaveLeagueButton,
} from "./settings-buttons";

const DOC_ITEMS = [
  {
    icon: Trophy,
    title: "How points work",
    subtitle: "PCS scoring, XP conversion, ranking",
  },
  {
    icon: Coins,
    title: "Bonus & money",
    subtitle: "Salaries, bonuses, treasury management",
  },
  {
    icon: Layers,
    title: "Team levels & unlocks",
    subtitle: "XP thresholds, slots, policies, pool",
  },
  {
    icon: Gavel,
    title: "Auctions & rounds",
    subtitle: "Bidding, sealed rounds, schedule",
  },
];

export default async function SettingsPage({
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
          Please sign in to view settings.
        </p>
      </div>
    );
  }

  const { data: member } = await supabase
    .from("league_members")
    .select("id, team_id, teams:team_id(id, name)")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, invite_code, commissioner_id")
    .eq("id", leagueId)
    .single();

  // Fetch all user leagues for the selector (ST-4)
  const { data: allMemberships } = await supabase
    .from("league_members")
    .select("league_id, leagues:league_id(id, name)")
    .eq("user_id", user.id);

  const userLeagues = (allMemberships ?? [])
    .map((m) => {
      const l = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues;
      return l ? { id: (l as { id: string }).id, name: (l as { name: string }).name } : null;
    })
    .filter(Boolean) as { id: string; name: string }[];

  const userName =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";
  const userEmail = user.email ?? "";
  const initials = userName
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const memberTeam = member?.teams
    ? Array.isArray(member.teams) ? member.teams[0] : member.teams
    : null;

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://watthunter.com"}/league/join?code=${league?.invite_code ?? ""}`;

  return (
    <div className="min-h-screen">
      <BackHeader label="Back" />

      <div className="px-4 pt-4 space-y-6">
        {/* Section 1: Account Settings (ST-1, ST-2, ST-3) */}
        <div className="space-y-3">
          <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-low)]">
            Account
          </span>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface)] text-sm font-bold text-[var(--text-mid)]">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-high)] truncate">
                {userName}
              </p>
              <p className="text-xs text-[var(--text-low)] truncate">
                {userEmail}
              </p>
            </div>
          </div>

          <SignOutButton />
        </div>

        {/* Divider */}
        <div className="border-t border-[var(--border-subtle)]" />

        {/* Section 2: League Settings (ST-4, ST-5, ST-6, ST-7) */}
        <div className="space-y-3">
          <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-low)]">
            League
          </span>

          <div className="space-y-4">
            {/* League selector (ST-4) */}
            {userLeagues.length > 1 ? (
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-low)]">
                  Current league
                </label>
                <div className="flex h-9 items-center rounded-lg border border-[var(--border-default)] bg-transparent px-3">
                  <span className="text-sm font-semibold text-[var(--text-high)]">
                    {league?.name ?? "League"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--text-high)]">
                  {league?.name ?? "League"}
                </span>
                <span className="text-xs font-medium text-[var(--text-mid)]">
                  {league?.commissioner_id === user.id ? "Race Director" : "Member"}
                </span>
              </div>
            )}

            {/* Team name — editable (ST-5) */}
            <div className="space-y-1">
              <label className="text-xs text-[var(--text-low)]">
                Team name
              </label>
              <EditableTeamName
                teamId={(memberTeam as { id: string })?.id ?? ""}
                initialName={(memberTeam as { name: string })?.name ?? "My Team"}
              />
            </div>

            {/* Invite URL (ST-6) */}
            <div className="space-y-1">
              <label className="text-xs text-[var(--text-low)]">
                Invite URL
              </label>
              <div className="flex items-center gap-2">
                <div className="flex h-9 flex-1 items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 overflow-hidden">
                  <span className="text-xs text-[var(--text-mid)] truncate">
                    {inviteUrl}
                  </span>
                </div>
                <CopyInviteCodeButton code={inviteUrl} />
              </div>
            </div>

            {/* Invite code (ST-6) */}
            <div className="space-y-1">
              <label className="text-xs text-[var(--text-low)]">
                Invite code
              </label>
              <div className="flex items-center gap-2">
                <div className="flex h-9 flex-1 items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3">
                  <span className="font-mono text-sm text-[var(--text-mid)]">
                    {league?.invite_code ?? "------"}
                  </span>
                </div>
                <CopyInviteCodeButton code={league?.invite_code ?? ""} />
              </div>
            </div>

            {/* Leave league (ST-7) */}
            <LeaveLeagueButton leagueId={leagueId} />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[var(--border-subtle)]" />

        {/* Section 3: Documentation (ST-8 hover state) */}
        <div className="space-y-3">
          <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-low)]">
            Documentation
          </span>

          <div className="divide-y divide-[var(--border-subtle)]">
            {DOC_ITEMS.map((item) => (
              <button
                key={item.title}
                type="button"
                className="flex w-full items-center gap-3 py-3 text-left rounded-lg hover:bg-[var(--bg-subtle)] transition-colors -mx-2 px-2"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)]">
                  <item.icon size={18} className="text-[var(--text-mid)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-high)]">
                    {item.title}
                  </p>
                  <p className="text-xs text-[var(--text-low)]">
                    {item.subtitle}
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  className="shrink-0 text-[var(--text-ghost)]"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Bottom spacing */}
        <div className="pb-8" />
      </div>
    </div>
  );
}
