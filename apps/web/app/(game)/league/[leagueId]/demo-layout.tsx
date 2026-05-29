import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { BottomNav } from "@/components/bottom-nav";
import { RailProvider } from "@/contexts/rail-context";
import { DemoProvider } from "@/contexts/demo-context";
import { DemoBanner } from "@/components/demo/demo-banner";
import { DemoBottomCta } from "@/components/demo/demo-bottom-cta";
import { LeagueShell } from "./league-shell";
import {
  DEMO_LEAGUE_ID,
  DEMO_LEAGUE_SLUG,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

export async function DemoLeagueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: league } = await supabase
    .from("leagues")
    .select("id, name")
    .eq("id", DEMO_LEAGUE_ID)
    .maybeSingle();

  const leagueName = league?.name ?? "Demo League";
  const leagues = [{ id: DEMO_LEAGUE_SLUG, name: leagueName }];

  const unlockedTabs: (
    | "home"
    | "auction"
    | "team"
    | "budget"
    | "ranking"
    | "achievements"
  )[] = ["home", "auction", "team", "budget", "ranking", "achievements"];

  return (
    <DemoProvider visitorTeamId={DEMO_VISITOR_TEAM_ID}>
      <RailProvider>
        <div className="flex h-[100svh] flex-col overflow-hidden">
          <DemoBanner />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar
              leagueId={DEMO_LEAGUE_SLUG}
              leagueName={leagueName}
              leagues={leagues}
              unlockedTabs={unlockedTabs}
            />
            <LeagueShell>
              <main className="flex-1 overflow-y-auto pb-20 lg:pb-8 lg:flex-[3] lg:min-w-[440px]">
                <TopBar
                  leagueId={DEMO_LEAGUE_SLUG}
                  leagueName={leagueName}
                  leagues={leagues}
                  settingsHref={`/league/${DEMO_LEAGUE_SLUG}`}
                />
                {children}
              </main>
              <BottomNav leagueId={DEMO_LEAGUE_SLUG} unlockedTabs={unlockedTabs} />
              <DemoBottomCta />
            </LeagueShell>
          </div>
        </div>
      </RailProvider>
    </DemoProvider>
  );
}
