import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function BudgetPage({
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
    redirect("/login");
  }

  const { data: member } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    redirect("/league/choose");
  }

  return (
    <div className="px-4 py-8">
      <h1 className="text-[length:var(--type-title)] font-bold text-[var(--text-high)]">Budget</h1>
      <p className="text-[length:var(--type-body)] text-[var(--text-mid)] mt-2">Coming soon</p>
    </div>
  );
}
