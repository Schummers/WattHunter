import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  expandNationality,
  RESULT_CONDITION_FILTERS,
  type SponsorEligibility,
  type SponsorRow,
} from "@/lib/sponsors";
import { isInAuctionWindow, isLeagueFirstCycle } from "@/lib/phases";
import { MarketplaceClient } from "./marketplace-client";

async function checkSponsorEligibility(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teamId: string,
  sponsors: SponsorRow[],
): Promise<SponsorEligibility[]> {
  // Get active contracts → rider IDs
  const { data: contracts } = await supabase
    .from("contracts")
    .select("rider_id")
    .eq("team_id", teamId)
    .in("status", ["active", "notice"]);

  const riderIds = (contracts ?? []).map((c) => c.rider_id);

  // Fetch active specialist policy for specialty eligibility
  const { data: teamPolicies } = await supabase
    .from("team_policies")
    .select("config, policies!policy_id(slug)")
    .eq("team_id", teamId)
    .eq("is_active", true);

  const activeSpecialty = (teamPolicies ?? [])
    .find((p) => {
      const pol = p.policies as unknown as { slug: string } | null;
      return pol?.slug === "specialist";
    })
    ?.config?.specialty as string | null ?? null;

  if (riderIds.length === 0) {
    return sponsors.map((s) => ({
      sponsorId: s.id,
      eligible: s.tier === 1,
      conditions: {
        nationality: s.nationality ? false : null,
        specialty: s.specialty.length > 0 ? false : null,
        result: s.result_condition ? false : null,
      },
    }));
  }

  // Fetch rider data
  const { data: riders } = await supabase
    .from("riders")
    .select("id, nationality, specialty")
    .in("id", riderIds);

  // Fetch race results this season
  const currentYear = new Date().getFullYear();
  const seasonStart = `${currentYear}-01-01`;
  const { data: raceResults } = await supabase
    .from("race_results")
    .select("rider_id, race_class, rank")
    .in("rider_id", riderIds)
    .gte("race_date", seasonStart)
    .not("race_class", "is", null);

  const riderList = riders ?? [];
  const resultList = raceResults ?? [];

  return sponsors.map((sponsor) => {
    // Lotto T1 — always eligible, no conditions
    if (sponsor.tier === 1) {
      return {
        sponsorId: sponsor.id,
        eligible: true,
        conditions: { nationality: null, specialty: null, result: null },
      };
    }

    // Check nationality
    let nationalityMet: boolean | null = null;
    if (sponsor.nationality && sponsor.nationality_count > 0) {
      const accepted = expandNationality(sponsor.nationality);
      const count = riderList.filter((r) => r.nationality && accepted.includes(r.nationality)).length;
      nationalityMet = count >= sponsor.nationality_count;
    }

    // Check specialty — compare against team's active Specialist policy
    let specialtyMet: boolean | null = null;
    if (sponsor.specialty.length > 0) {
      specialtyMet = activeSpecialty
        ? sponsor.specialty.some((s) => s.toLowerCase() === activeSpecialty.toLowerCase())
        : false;
    }

    // Check result condition
    let resultMet: boolean | null = null;
    if (sponsor.result_condition) {
      const filter = RESULT_CONDITION_FILTERS[sponsor.result_condition];
      if (filter) {
        resultMet = resultList.some(
          (rr) =>
            rr.race_class &&
            filter.race_class.includes(rr.race_class) &&
            rr.rank != null &&
            rr.rank <= filter.max_position,
        );
      }
    }

    const eligible =
      (nationalityMet === null || nationalityMet) &&
      (specialtyMet === null || specialtyMet) &&
      (resultMet === null || resultMet);

    return {
      sponsorId: sponsor.id,
      eligible,
      conditions: {
        nationality: nationalityMet,
        specialty: specialtyMet,
        result: resultMet,
      },
    };
  });
}

export default async function MarketplacePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: team } = await supabase
    .from("teams")
    .select("id, level")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!team) redirect(`/league/${leagueId}`);

  // Fetch all sponsors
  const { data: allSponsors } = await supabase
    .from("sponsors")
    .select("*")
    .order("sort_order", { ascending: true });

  // Current team sponsors
  const { data: teamSponsors } = await supabase
    .from("team_sponsors")
    .select("id, slot, sponsor_id, status")
    .eq("team_id", team.id)
    .eq("status", "active");

  const sponsors = (allSponsors ?? []) as SponsorRow[];
  const eligibility = await checkSponsorEligibility(supabase, team.id, sponsors);

  const activeSecondary = teamSponsors?.find((ts) => ts.slot === "secondary")?.sponsor_id ?? null;
  const activePrincipal = teamSponsors?.find((ts) => ts.slot === "principal")?.sponsor_id ?? null;

  return (
    <MarketplaceClient
      leagueId={leagueId}
      teamId={team.id}
      level={team.level}
      sponsors={sponsors}
      eligibility={eligibility}
      activeSecondary={activeSecondary}
      activePrincipal={activePrincipal}
      isInAuctionWindow={isInAuctionWindow() || await isLeagueFirstCycle(supabase, leagueId)}
    />
  );
}
