"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { RiderDetailClient } from "@/app/(game)/league/[leagueId]/rider/[riderId]/rider-detail-client";
import { getMaxSlots } from "@/lib/levels";
import { calcMinSalary } from "@/lib/format";

interface Props {
  leagueId: string;
  riderId: string;
  from?: string;
}

type RiderContext = "recruts" | "team" | "ranking";

export default function RiderDetailRail({ leagueId, riderId, from }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    rider: any;
    rankings: any[];
    startlists: any[];
    raceResults: any[];
    context: RiderContext;
    minSalary: number;
    currentBidId: string | null;
    currentBidAmount: number | null;
    activeAuctionId: string | null;
    contractData: { locked_salary: number; status: string } | null;
    ownerInfo: { display_name: string; team_name: string } | null;
    budgetInfo?: { currentSlots: number; maxSlots: number; treasury: number; totalBidAmount: number };
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      const supabase = createClient();

      // Fetch rider
      const { data: rider, error: riderErr } = await supabase
        .from("riders")
        .select("*")
        .eq("id", riderId)
        .single();

      if (riderErr || !rider) {
        if (!cancelled) { setError("Rider not found"); setLoading(false); }
        return;
      }

      // Fetch rankings
      const { data: rankings } = await supabase
        .from("rider_season_rankings")
        .select("*")
        .eq("rider_id", riderId)
        .order("season", { ascending: false });

      // Fetch rider teams for season table
      const { data: riderTeams } = await supabase
        .from("rider_teams")
        .select("season, team_name")
        .eq("rider_id", riderId);

      const teamBySeason: Record<number, string> = {};
      for (const rt of riderTeams ?? []) {
        teamBySeason[rt.season] = rt.team_name;
      }

      // Fetch startlists
      const { data: startlists } = await supabase
        .from("race_startlists")
        .select("race_slug, race_name, race_date")
        .eq("rider_id", riderId)
        .order("race_date", { ascending: true });

      // Fetch race results
      const { data: raceResults } = await supabase
        .from("race_results")
        .select("race_name, race_date, pcs_points, rider_id")
        .eq("rider_id", riderId)
        .order("race_date", { ascending: false });

      // Auth + context
      const { data: { user } } = await supabase.auth.getUser();
      let context: RiderContext = (from as RiderContext) ?? "ranking";
      let contractData: { locked_salary: number; status: string } | null = null;
      let currentBidId: string | null = null;
      let currentBidAmount: number | null = null;
      let activeAuctionId: string | null = null;
      let ownerInfo: { display_name: string; team_name: string } | null = null;
      let budgetInfo: { currentSlots: number; maxSlots: number; treasury: number; totalBidAmount: number } | undefined;

      if (user) {
        const { data: member } = await supabase
          .from("league_members")
          .select("id, team_id")
          .eq("league_id", leagueId)
          .eq("user_id", user.id)
          .single();

        if (member?.team_id) {
          const { data: contract } = await supabase
            .from("contracts")
            .select("id, locked_salary, status")
            .eq("team_id", member.team_id)
            .eq("rider_id", riderId)
            .in("status", ["active", "notice"])
            .maybeSingle();

          if (contract) {
            if (from !== "recruts" && from !== "team") context = "team";
            contractData = { locked_salary: contract.locked_salary, status: contract.status };
          }

          const { data: activeBid } = await supabase
            .from("auction_bids")
            .select("id, amount, auction_id")
            .eq("team_id", member.team_id)
            .eq("rider_id", riderId)
            .eq("status", "active")
            .maybeSingle();

          if (activeBid) {
            currentBidId = activeBid.id;
            currentBidAmount = activeBid.amount;
            activeAuctionId = activeBid.auction_id;
          }

          if (!activeAuctionId) {
            const { data: auction } = await supabase
              .from("auctions")
              .select("id")
              .eq("league_id", leagueId)
              .in("status", ["active", "open"])
              .maybeSingle();
            if (auction) activeAuctionId = auction.id;
          }

          // Budget info for recruts context
          if (context === "recruts") {
            const { data: teamData } = await supabase
              .from("teams")
              .select("level, treasury")
              .eq("id", member.team_id)
              .single();

            if (teamData) {
              const level = teamData.level ?? 1;
              const maxSlots = getMaxSlots(level);

              const { count: contractCount } = await supabase
                .from("contracts")
                .select("id", { count: "exact", head: true })
                .eq("team_id", member.team_id)
                .in("status", ["active", "notice"]);

              const { data: allActiveBids } = await supabase
                .from("auction_bids")
                .select("amount")
                .eq("team_id", member.team_id)
                .eq("status", "active");

              const totalBidAmount = (allActiveBids ?? []).reduce((sum, b) => sum + b.amount, 0);

              budgetInfo = {
                currentSlots: contractCount ?? 0,
                maxSlots,
                treasury: teamData.treasury ?? 200000,
                totalBidAmount,
              };
            }
          }
        }
      }

      if (context === "ranking") {
        const { data: ownerContract } = await supabase
          .from("contracts")
          .select("team_id, teams:team_id(name, league_id)")
          .eq("rider_id", riderId)
          .in("status", ["active", "notice"])
          .maybeSingle();

        if (ownerContract) {
          const ownerTeam = Array.isArray(ownerContract.teams) ? ownerContract.teams[0] : ownerContract.teams;
          if (ownerTeam && (ownerTeam as any).league_id === leagueId) {
            ownerInfo = { display_name: "", team_name: (ownerTeam as any).name };
          }
        }
      }

      const minSalary = calcMinSalary(rider.pcs_points_1yr ?? 0);

      if (!cancelled) {
        setData({
          rider: {
            id: rider.id,
            full_name: rider.full_name,
            nationality: rider.nationality,
            team_name: rider.real_team,
            pcs_rank: rider.pcs_rank,
            pcs_points_1yr: rider.pcs_points_1yr,
            photo_url: rider.photo_url,
            specialty: rider.specialty,
            birthdate: rider.birthdate,
            height_cm: rider.height_cm,
            weight_kg: rider.weight_kg,
          },
          rankings: (rankings ?? []).map((r) => ({
            rider_id: r.rider_id,
            season: r.season,
            points: r.points,
            rank: r.rank,
            team: teamBySeason[r.season] ?? null,
          })),
          startlists: (startlists ?? []).map((s) => ({
            race_name: s.race_name,
            race_date: s.race_date,
          })),
          raceResults: (raceResults ?? []).map((r) => ({
            race_name: r.race_name,
            race_date: r.race_date,
            pcs_points: r.pcs_points,
          })),
          context,
          minSalary,
          currentBidId,
          currentBidAmount,
          activeAuctionId,
          contractData,
          ownerInfo,
          budgetInfo,
        });
        setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [leagueId, riderId, from]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-6 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-default)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-4 py-8">
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)]">{error ?? "Error loading rider"}</p>
      </div>
    );
  }

  return (
    <RiderDetailClient
      leagueId={leagueId}
      rider={data.rider}
      rankings={data.rankings}
      startlists={data.startlists}
      raceResults={data.raceResults}
      context={data.context}
      minSalary={data.minSalary}
      currentBidId={data.currentBidId ?? undefined}
      currentBidAmount={data.currentBidAmount}
      activeAuctionId={data.activeAuctionId}
      contractData={data.contractData}
      ownerInfo={data.ownerInfo}
      budgetInfo={data.budgetInfo}
      inRail
    />
  );
}
