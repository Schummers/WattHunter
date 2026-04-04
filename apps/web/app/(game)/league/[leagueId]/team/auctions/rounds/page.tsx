import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { RoundsClient } from "./rounds-client";

/** Extract "YYYY-MM-DD" and "HH:MM" from an ISO timestamp, converted to Europe/Paris time. */
function splitDateTime(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const date = d.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }); // "YYYY-MM-DD"
  const time = d.toLocaleTimeString("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }); // "HH:MM"
  return { date, time };
}

export default async function EditRoundDatesPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    redirect(`/login`);
  }

  // Verify commissioner
  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, commissioner_id")
    .eq("id", leagueId)
    .single();

  if (!league || league.commissioner_id !== user.id) {
    redirect(`/league/${leagueId}/team/auctions`);
  }

  // Fetch open/scheduled auction rounds
  const { data: auctionRounds } = await supabase
    .from("auctions")
    .select("id, name, opens_at, closes_at, status")
    .eq("league_id", leagueId)
    .in("status", ["open", "scheduled"])
    .order("opens_at", { ascending: true });

  const initialRounds = (auctionRounds ?? []).map((r) => {
    const { date, time } = splitDateTime(r.opens_at);
    return {
      id: r.id,
      name: r.name,
      date,
      time,
    };
  });

  return (
    <RoundsClient
      leagueId={leagueId}
      leagueName={league.name}
      initialRounds={initialRounds}
    />
  );
}
