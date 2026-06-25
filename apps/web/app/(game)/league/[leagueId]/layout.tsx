import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { BottomNav } from "@/components/bottom-nav";
import { EmailConfirmationBanner } from "@/components/email-confirmation-banner";
import { RailProvider } from "@/contexts/rail-context";
import { LeagueShell } from "./league-shell";
import { DemoLeagueLayout } from "./demo-layout";
import { DEMO_LEAGUE_SLUG } from "@/lib/demo-constants";
import { type LeagueMode } from "@/lib/league-mode";
import { LeagueModeProvider } from "@/contexts/league-mode-context";

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  if (leagueId === DEMO_LEAGUE_SLUG) {
    return <DemoLeagueLayout>{children}</DemoLeagueLayout>;
  }

  const supabase = await createClient();

  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch league membership, all user leagues, and auctions in parallel
  const [{ data: membership }, { data: allMemberships }, { data: auctions }] =
    await Promise.all([
      supabase
        .from("league_members")
        .select("team_id, leagues:league_id(name, mode), teams:team_id(name)")
        .eq("league_id", leagueId)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("league_members")
        .select("league_id, leagues:league_id(id, name)")
        .eq("user_id", user.id),
      supabase
        .from("auctions")
        .select("id, status")
        .eq("league_id", leagueId),
    ]);

  if (!membership) {
    redirect("/league/choose");
  }

  const leagueData = membership.leagues as unknown as { name: string; mode: string | null } | null;
  const leagueName = leagueData?.name ?? "League";
  const leagueMode = (leagueData?.mode ?? "manager") as LeagueMode;

  const leagues = (allMemberships ?? []).map((m) => {
    const league = m.leagues as unknown as { id: string; name: string };
    return { id: league.id, name: league.name };
  });

  // Determine unlocked tabs based on league state
  const unlockedTabs: ("home" | "auction" | "team" | "budget" | "ranking" | "achievements")[] = ["home"];

  if (auctions && auctions.length > 0) {
    unlockedTabs.push("auction", "team", "budget", "ranking", "achievements");
  }

  return (
    <RailProvider>
      <div className="flex h-[100svh] flex-col overflow-hidden">
        <EmailConfirmationBanner
          email={user.email ?? null}
          isConfirmed={!!user.email_confirmed_at}
        />
        <div className="flex flex-1 overflow-hidden">
        <Sidebar
          leagueId={leagueId}
          leagueName={leagueName}
          leagues={leagues}
          unlockedTabs={unlockedTabs}
          mode={leagueMode}
        />
        <LeagueShell>
          <main className="flex-1 overflow-y-auto pb-20 lg:pb-8 lg:flex-[3] lg:min-w-[440px]">
            <TopBar
              leagueId={leagueId}
              leagueName={leagueName}
              leagues={leagues}
              settingsHref={`/league/${leagueId}/settings`}
            />
            <LeagueModeProvider mode={leagueMode}>{children}</LeagueModeProvider>
          </main>
          <BottomNav leagueId={leagueId} unlockedTabs={unlockedTabs} mode={leagueMode} />
        </LeagueShell>
        </div>
      </div>
    </RailProvider>
  );
}
