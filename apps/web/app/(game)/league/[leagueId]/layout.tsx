import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { BottomNav } from "@/components/bottom-nav";
import { RailProvider } from "@/contexts/rail-context";
import { LeagueShell } from "./league-shell";

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch league membership (with league name via join)
  const { data: membership } = await supabase
    .from("league_members")
    .select("team_id, leagues:league_id(name), teams:team_id(name)")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    redirect("/league/choose");
  }

  const leagueName =
    (membership.leagues as unknown as { name: string } | null)?.name ?? "League";

  // Fetch all user leagues for switcher
  const { data: allMemberships } = await supabase
    .from("league_members")
    .select("league_id, leagues:league_id(id, name)")
    .eq("user_id", user.id);

  const leagues = (allMemberships ?? []).map((m) => {
    const league = m.leagues as unknown as { id: string; name: string };
    return { id: league.id, name: league.name };
  });

  // Determine unlocked tabs based on league state
  const unlockedTabs: ("home" | "team" | "budget" | "ranking")[] = ["home"];

  // Check if any auction exists (means first auction was launched)
  const { data: auctions } = await supabase
    .from("auctions")
    .select("id, status")
    .eq("league_id", leagueId);

  if (auctions && auctions.length > 0) {
    unlockedTabs.push("team", "budget", "ranking");
  }

  return (
    <RailProvider>
      <div className="flex h-[100svh] overflow-hidden">
        <Sidebar
          leagueId={leagueId}
          leagueName={leagueName}
          leagues={leagues}
          unlockedTabs={unlockedTabs}
        />
        <LeagueShell>
          <main className="flex-1 overflow-y-auto pb-20 lg:pb-8 lg:flex-[3] lg:min-w-[440px]">
            <TopBar
              leagueId={leagueId}
              leagueName={leagueName}
              leagues={leagues}
              settingsHref={`/league/${leagueId}/settings`}
            />
            {children}
          </main>
          <BottomNav leagueId={leagueId} unlockedTabs={unlockedTabs} />
        </LeagueShell>
      </div>
    </RailProvider>
  );
}
