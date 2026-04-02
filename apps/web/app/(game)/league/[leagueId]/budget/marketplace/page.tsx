import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MarketplaceClient } from "./marketplace-client";
import { getCurrentPhase, getNextPhase, isInAuctionWindow, isLeagueFirstCycle } from "@/lib/phases";
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

  const { data: team } = await supabase
    .from("teams")
    .select("id, level, pending_sponsor_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!team) redirect(`/league/${leagueId}`);

  const [{ data: sponsors }, { data: teamSponsor }] = await Promise.all([
    supabase.from("sponsors").select("*").order("sort_order"),
    supabase
      .from("team_sponsors")
      .select("*, sponsors(*)")
      .eq("team_id", team.id)
      .maybeSingle(),
  ]);

  // Determine if changes are immediate or pending
  const nextPhase = getNextPhase();
  const immediate = isInAuctionWindow() || await isLeagueFirstCycle(supabase, leagueId);

  return (
    <MarketplaceClient
      leagueId={leagueId}
      teamId={team.id}
      teamLevel={team.level}
      sponsors={(sponsors ?? []) as SponsorRow[]}
      currentSponsor={teamSponsor as TeamSponsor | null}
      nextPhaseName={nextPhase?.label ?? null}
      isImmediate={immediate}
      pendingSponsorId={team.pending_sponsor_id ?? null}
    />
  );
}
