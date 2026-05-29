import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { EmailConfirmationBanner } from "@/components/email-confirmation-banner";
import { Badge } from "@/components/ui/badge";

export default async function LobbyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const [{ data: membership }, { data: league }] = await Promise.all([
    supabase
      .from("league_members")
      .select("user_id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("leagues")
      .select("id, name, status")
      .eq("id", leagueId)
      .single(),
  ]);

  if (!league) {
    redirect("/league/choose");
  }

  if (!membership) {
    redirect("/league/choose");
  }

  if (league.status !== "pending") {
    redirect(`/league/${leagueId}`);
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-[var(--bg-app)]">
      <EmailConfirmationBanner
        email={user.email ?? null}
        isConfirmed={!!user.email_confirmed_at}
      />
      <header className="border-b border-[var(--border-subtle)] px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <h1 className="truncate text-[length:var(--type-page-title)] font-bold text-[var(--text-high)]">
            {league.name}
          </h1>
          <Badge variant="highlighted">Pending</Badge>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
