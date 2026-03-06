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
      .select("id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .single();

    if (member) {
      const { data: teamRider } = await supabase
        .from("team_riders")
        .select("id")
        .eq("league_member_id", member.id)
        .eq("rider_id", riderId)
        .eq("status", "active")
        .maybeSingle();

      isOwned = !!teamRider;
    }
  }

  return (
    <RiderDetailClient
      rider={{
        id: rider.id,
        full_name: rider.full_name,
        nationality: rider.nationality,
        team_name: rider.team_name,
        pcs_rank: rider.pcs_rank,
        pcs_points_1yr: rider.pcs_points_1yr,
        photo_url: rider.photo_url,
        specialty: rider.specialty,
        birthdate: rider.birthdate,
        height_cm: rider.height_cm,
        weight_kg: rider.weight_kg,
      }}
      rankings={(rankings ?? []).map((r) => ({
        id: r.id,
        rider_id: r.rider_id,
        season: r.season,
        pcs_points: r.pcs_points,
        pcs_rank: r.pcs_rank,
        team_name: r.team_name,
      }))}
      isOwned={isOwned}
    />
  );
}
