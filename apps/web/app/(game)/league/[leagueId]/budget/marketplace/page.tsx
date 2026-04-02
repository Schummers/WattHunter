import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MarketplaceClient } from "./marketplace-client";
import type { SponsorRow, TeamSponsor } from "@/lib/sponsors";

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function MarketplacePage({ params }: Props) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get team for this league
  const { data: team } = await supabase
    .from("teams")
    .select("id, level")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!team) redirect(`/league/${leagueId}`);

  // Get all sponsors (sorted by sort_order)
  const { data: sponsors } = await supabase
    .from("sponsors")
    .select("*")
    .order("sort_order");

  // Get current team sponsor (if any)
  const { data: teamSponsor } = await supabase
    .from("team_sponsors")
    .select("*, sponsors(*)")
    .eq("team_id", team.id)
    .maybeSingle();

  return (
    <MarketplaceClient
      leagueId={leagueId}
      teamId={team.id}
      teamLevel={team.level}
      sponsors={(sponsors ?? []) as SponsorRow[]}
      currentSponsor={teamSponsor as TeamSponsor | null}
    />
  );
}
