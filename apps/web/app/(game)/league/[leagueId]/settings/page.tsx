import { createClient } from "@/lib/supabase/server";
import { BackHeader } from "@/components/back-header";
import {
  Trophy,
  Coins,
  Layers,
  Gavel,
  ChevronRight,
  Plus,
} from "lucide-react";
import Link from "next/link";
import {
  CopyInviteCodeButton,
  SignOutButton,
  EditableField,
  LeaveLeagueButton,
  InviteUrlDisplay,
} from "./settings-buttons";
import {
  updateUserName,
  updateUserEmail,
  updateTeamName,
  updateLeagueName,
} from "./actions";

const DOC_ITEMS = [
  {
    slug: "points",
    icon: Trophy,
    title: "How points work",
    subtitle: "PCS scoring, XP conversion, ranking",
  },
  {
    slug: "money",
    icon: Coins,
    title: "Bonus & money",
    subtitle: "Salaries, bonuses, treasury management",
  },
  {
    slug: "levels",
    icon: Layers,
    title: "Team levels & unlocks",
    subtitle: "XP thresholds, slots, policies, pool",
  },
  {
    slug: "auctions",
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
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">
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

  // Fetch commissioner name via league_members → teams
  let commissionerName = "Race Director";
  if (league?.commissioner_id) {
    if (league.commissioner_id === user.id) {
      commissionerName =
        user.user_metadata?.full_name ??
        user.email?.split("@")[0] ??
        "Race Director";
    } else {
      const { data: commMember } = await supabase
        .from("league_members")
        .select("teams:team_id(name)")
        .eq("league_id", leagueId)
        .eq("user_id", league.commissioner_id)
        .single();
      if (commMember?.teams) {
        const t = Array.isArray(commMember.teams)
          ? commMember.teams[0]
          : commMember.teams;
        commissionerName = (t as { name: string })?.name ?? "Race Director";
      }
    }
  }

  const isCommissioner = league?.commissioner_id === user.id;

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
    ? Array.isArray(member.teams)
      ? member.teams[0]
      : member.teams
    : null;

  return (
    <div className="min-h-screen">
      <BackHeader label="Back" />

      <div className="px-4 pt-4 space-y-6">
        {/* Section 1: Account */}
        <div className="space-y-3">
          <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Account
          </span>

          <div className="flex items-start gap-3">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[length:var(--type-section)] font-bold text-[var(--text-mid)]">
              {initials}
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <EditableField
                label="First name"
                initialValue={userName}
                onSave={async (value) => {
                  "use server";
                  return updateUserName(value);
                }}
              />
              <EditableField
                label="Email"
                initialValue={userEmail}
                onSave={async (value) => {
                  "use server";
                  return updateUserEmail(value);
                }}
              />
            </div>
          </div>

          {/* Create a new league */}
          <Link
            href="/league/create"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--accent-default)] px-4 py-2.5 text-[length:var(--type-body)] font-semibold text-[var(--accent-default)] transition-colors hover:bg-[var(--accent-default)] hover:text-[var(--bg-app)]"
          >
            <Plus size={16} />
            Create a new league
          </Link>

          {/* Sign out */}
          <SignOutButton />
        </div>

        {/* Divider */}
        <div className="border-t border-[var(--border-subtle)]" />

        {/* Section 2: League */}
        <div className="space-y-3">
          <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            League
          </span>

          <div className="space-y-4">
            {/* League name */}
            <EditableField
              label="League name"
              initialValue={league?.name ?? "League"}
              onSave={async (value) => {
                "use server";
                return updateLeagueName(leagueId, value);
              }}
              disabled={!isCommissioner}
            />

            {/* Race director */}
            <div className="space-y-1">
              <label className="text-[length:var(--type-caption)] font-medium text-[var(--text-low)]">
                Race director
              </label>
              <div className="flex h-9 items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3">
                <span className="text-[length:var(--type-body)] text-[var(--text-mid)]">
                  {commissionerName}
                </span>
              </div>
            </div>

            {/* Team name — editable */}
            <EditableField
              label="Team name"
              initialValue={
                (memberTeam as { name: string })?.name ?? "My Team"
              }
              onSave={async (value) => {
                "use server";
                return updateTeamName(
                  (memberTeam as { id: string })?.id ?? "",
                  value
                );
              }}
            />

            {/* Invite URL */}
            <InviteUrlDisplay inviteCode={league?.invite_code ?? ""} />

            {/* Invite code */}
            <div className="space-y-1">
              <label className="text-[length:var(--type-caption)] font-medium text-[var(--text-low)]">
                Invite code
              </label>
              <div className="flex items-center gap-2">
                <div className="flex h-9 flex-1 items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3">
                  <span className="font-mono text-[length:var(--type-body)] text-[var(--text-mid)]">
                    {league?.invite_code ?? "------"}
                  </span>
                </div>
                <CopyInviteCodeButton code={league?.invite_code ?? ""} />
              </div>
            </div>

            {/* Leave league */}
            <LeaveLeagueButton leagueId={leagueId} />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[var(--border-subtle)]" />

        {/* Section 3: Documentation */}
        <div className="space-y-3">
          <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
            Documentation
          </span>

          <div className="divide-y divide-[var(--border-subtle)]">
            {DOC_ITEMS.map((item) => (
              <Link
                key={item.slug}
                href={`/league/${leagueId}/settings/docs/${item.slug}`}
                className="flex w-full items-center gap-3 py-3 text-left rounded-lg hover:bg-[var(--bg-subtle)] transition-colors -mx-2 px-2"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)]">
                  <item.icon
                    size={18}
                    className="text-[var(--text-mid)]"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
                    {item.title}
                  </p>
                  <p className="text-[length:var(--type-caption)] text-[var(--text-low)]">
                    {item.subtitle}
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  className="shrink-0 text-[var(--text-ghost)]"
                />
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom spacing */}
        <div className="pb-8" />
      </div>
    </div>
  );
}
