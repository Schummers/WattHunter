import { createClient } from "@/lib/supabase/server";
import { RiderDetailClient } from "./rider-detail-client";

export default async function RiderDetailPage({
  params,
}: {
  params: Promise<{ leagueId: string; riderId: string }>;
}) {
  const { leagueId, riderId } = await params;
  const supabase = await createClient();

  // Get rider
  const { data: rider } = await supabase
    .from("riders")
    .select("*")
    .eq("id", riderId)
    .single();

  if (!rider) {
    return (
      <div className="px-4 py-8">
        <p className="text-sm text-[var(--text-mid)]">Rider not found.</p>
      </div>
    );
  }

  // Get season rankings
  const { data: rankings } = await supabase
    .from("rider_season_rankings")
    .select("*")
    .eq("rider_id", riderId)
    .order("season", { ascending: false });

  // Check if rider is owned by current user in this league
  let isOwned = false;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: member } = await supabase
      .from("league_members")
      .select("id, team_id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .single();

    if (member) {
      const teamId = member.team_id;
      if (teamId) {
        const { data: contract } = await supabase
          .from("contracts")
          .select("id")
          .eq("team_id", teamId)
          .eq("rider_id", riderId)
          .in("status", ["active", "notice"])
          .maybeSingle();

        isOwned = !!contract;
      }
    }
  }

  return (
    <RiderDetailClient
      rider={{
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
      }}
      rankings={(rankings ?? []).map((r) => ({
        rider_id: r.rider_id,
        season: r.season,
        points: r.points,
        rank: r.rank,
      }))}
      isOwned={isOwned}
    />
  );
}
