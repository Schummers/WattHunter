import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MarketplaceClient } from "./marketplace-client";
import { getNextPhase, isLeagueFirstCycle } from "@/lib/phases";
import { getOpenAuction } from "@/lib/supabase/get-open-auction";
import type { SponsorRow, TeamSponsor } from "@/lib/sponsors";
import {
  DEMO_LEAGUE_SLUG,
  DEMO_LEAGUE_ID,
  DEMO_VISITOR_TEAM_ID,
} from "@/lib/demo-constants";

interface Props {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function MarketplacePage({ params, searchParams }: Props) {
  const { leagueId } = await params;
  const { from } = await searchParams;
  const backLabel = from === "auctions" ? "Auctions" : "Budget";

  if (leagueId === DEMO_LEAGUE_SLUG) return await renderDemoTeamMarketplace(backLabel);

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
  const openAuction = await getOpenAuction(supabase, leagueId);
  const immediate = !!openAuction || await isLeagueFirstCycle(supabase, leagueId);

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
      backLabel={backLabel}
    />
  );
}

// ---------------------------------------------------------------------------
// Demo path — anonymous visitor, no auth required
// ---------------------------------------------------------------------------
async function renderDemoTeamMarketplace(backLabel: string) {
  const supabase = await createClient();
  const teamId = DEMO_VISITOR_TEAM_ID;
  const leagueId = DEMO_LEAGUE_ID;

  const { data: team } = await supabase
    .from("teams")
    .select("id, level, pending_sponsor_id")
    .eq("id", teamId)
    .single();

  if (!team) return <p className="text-[var(--text-mid)]">Demo team not found.</p>;

  const [{ data: sponsors }, { data: teamSponsor }] = await Promise.all([
    supabase.from("sponsors").select("*").order("sort_order"),
    supabase
      .from("team_sponsors")
      .select("*, sponsors(*)")
      .eq("team_id", team.id)
      .maybeSingle(),
  ]);

  const nextPhase = getNextPhase();
  const openAuction = await getOpenAuction(supabase, leagueId);
  const immediate = !!openAuction || await isLeagueFirstCycle(supabase, leagueId);

  return (
    <MarketplaceClient
      leagueId={DEMO_LEAGUE_SLUG}
      teamId={team.id}
      teamLevel={team.level}
      sponsors={(sponsors ?? []) as SponsorRow[]}
      currentSponsor={teamSponsor as TeamSponsor | null}
      nextPhaseName={nextPhase?.label ?? null}
      isImmediate={immediate}
      pendingSponsorId={team.pending_sponsor_id ?? null}
      backLabel={backLabel}
    />
  );
}
