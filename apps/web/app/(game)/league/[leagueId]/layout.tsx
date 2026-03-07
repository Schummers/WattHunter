import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { BottomNav } from "@/components/bottom-nav";

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

  // Count user's leagues for hasMultipleLeagues
  const { count: leagueCount } = await supabase
    .from("league_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const hasMultipleLeagues = (leagueCount ?? 0) > 1;

  // Determine unlocked tabs based on league state
  const unlockedTabs: ("home" | "team" | "budget" | "ranking")[] = ["home"];

  // Check if any auction round exists (means first auction was launched)
  const { data: auctions } = await supabase
    .from("auction_rounds")
    .select("id, status")
    .eq("league_id", leagueId);

  if (auctions && auctions.length > 0) {
    unlockedTabs.push("team");

    // Check if any round is completed
    const hasCompleted = auctions.some(
      (a: { status: string }) => a.status === "completed",
    );
    if (hasCompleted) {
      unlockedTabs.push("budget", "ranking");
    }
  }

  return (
    <div className="flex h-[100svh] overflow-hidden">
      <Sidebar
        leagueId={leagueId}
        leagueName={leagueName}
        unlockedTabs={unlockedTabs}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          leagueName={leagueName}
          hasMultipleLeagues={hasMultipleLeagues}
          settingsHref={`/league/${leagueId}/settings`}
        />
        <main className="flex-1 overflow-y-auto px-4 pb-20 lg:mx-auto lg:max-w-2xl lg:px-8 lg:pb-8">
          {children}
        </main>
        <BottomNav leagueId={leagueId} unlockedTabs={unlockedTabs} />
      </div>
    </div>
  );
}
