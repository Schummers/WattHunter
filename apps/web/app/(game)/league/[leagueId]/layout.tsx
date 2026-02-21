import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";

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

  const [{ data: profile }, { data: league }] = await Promise.all([
    supabase.from("users").select("display_name, avatar_url").eq("id", user.id).single(),
    supabase.from("leagues").select("name").eq("id", leagueId).single(),
  ]);

  if (!league) {
    redirect("/");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar leagueId={leagueId} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          title={league.name}
          userDisplayName={profile?.display_name}
          userAvatarUrl={profile?.avatar_url ?? undefined}
        />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
