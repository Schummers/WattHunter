import { createClient } from "@/lib/supabase/server";
import { BackHeader } from "@/components/back-header";
import {
  Trophy,
  Coins,
  Layers,
  Gavel,
  LogOut,
  Copy,
  ChevronRight,
} from "lucide-react";

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
    .select("id, team_name, role")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, invite_code")
    .eq("id", leagueId)
    .single();

  const userName =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";
  const userEmail = user.email ?? "";
  const initials = userName
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleName =
    member?.role === "owner" ? "Race Director" : "Member";

  return (
    <div className="min-h-screen">
      <BackHeader label="Back" />

      <div className="px-4 space-y-6">
        {/* Profile hero */}
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
          <span className="text-xs font-semibold text-[var(--accent-default)]">
            Edit profile
            <ChevronRight size={12} className="inline ml-0.5" />
          </span>
        </div>

        {/* League section */}
        <div className="space-y-3">
          <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-low)]">
            League
          </span>

          <div className="space-y-4">
            {/* League name + role */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text-high)]">
                {league?.name ?? "League"}
              </span>
              <span className="text-xs font-medium text-[var(--text-mid)]">
                {roleName}
              </span>
            </div>

            {/* Team name */}
            <div className="space-y-1">
              <label className="text-xs text-[var(--text-low)]">
                Team name
              </label>
              <div className="flex h-9 items-center rounded-lg border border-[var(--border-default)] bg-transparent px-3">
                <span className="text-sm text-[var(--text-high)]">
                  {member?.team_name ?? "My Team"}
                </span>
              </div>
            </div>

            {/* Invite code */}
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
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-mid)] hover:border-[var(--border-hover)]"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            {/* Leave league */}
            <button
              type="button"
              className="text-sm font-medium text-[var(--status-danger)]"
            >
              Leave league
            </button>
          </div>
        </div>

        {/* Documentation */}
        <div className="space-y-3">
          <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-low)]">
            Documentation
          </span>

          <div className="divide-y divide-[var(--border-subtle)]">
            {DOC_ITEMS.map((item) => (
              <button
                key={item.title}
                type="button"
                className="flex w-full items-center gap-3 py-3 text-left"
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

        {/* Sign out */}
        <div className="pb-8">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-[var(--status-danger)]"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
