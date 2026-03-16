"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Compute the Europe/Paris UTC offset for a given date.
 * Returns "+01:00" (CET winter) or "+02:00" (CEST summer).
 */
function getParisOffset(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`);
  const utcMs = date.getTime();
  const parisMs = new Date(
    date.toLocaleString("en-US", { timeZone: "Europe/Paris" })
  ).getTime();
  const diffHours = Math.round((parisMs - utcMs) / 3600000);
  const sign = diffHours >= 0 ? "+" : "-";
  return `${sign}${String(Math.abs(diffHours)).padStart(2, "0")}:00`;
}

export async function launchFirstAuction(
  leagueId: string,
  roundDates: string[] // ["2026-03-08", "2026-03-09", "2026-03-10"]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("id, commissioner_id, status")
    .eq("id", leagueId)
    .single();

  if (!league || league.commissioner_id !== user.id) {
    return { error: "Only the Race Director can launch the first auction." };
  }

  if (league.status !== "pending") {
    return { error: "The league has already started." };
  }

  if (!roundDates || roundDates.length === 0 || roundDates.length > 3) {
    return { error: "Please configure 1 to 3 rounds." };
  }

  const auctionRows = roundDates.map((dateStr, i) => {
    const offset = getParisOffset(dateStr);
    const nextDate = roundDates[i + 1];
    const closesAt = nextDate
      ? `${nextDate}T00:00:00${getParisOffset(nextDate)}`
      : `${dateStr}T23:59:59${offset}`;
    return {
      league_id: leagueId,
      name: `Round ${i + 1}`,
      status: i === 0 ? "open" : "scheduled",
      opens_at: `${dateStr}T00:00:00${offset}`,
      closes_at: closesAt,
    };
  });

  const { error: auctionError } = await supabase
    .from("auctions")
    .insert(auctionRows);

  if (auctionError) {
    return { error: "Failed to create the auction rounds." };
  }

  await supabase
    .from("leagues")
    .update({ status: "active" })
    .eq("id", leagueId);

  revalidatePath(`/league/${leagueId}`);
  return { success: true };
}
