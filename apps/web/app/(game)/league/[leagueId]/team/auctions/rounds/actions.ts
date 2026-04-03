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

export async function updateRoundDates(input: {
  leagueId: string;
  rounds: { id: string; date: string; time: string }[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated." };
  }

  const { data: league } = await supabase
    .from("leagues")
    .select("id, commissioner_id")
    .eq("id", input.leagueId)
    .single();

  if (!league || league.commissioner_id !== user.id) {
    return { error: "Only the Race Director can edit round dates." };
  }

  if (!input.rounds || input.rounds.length === 0) {
    return { error: "No rounds to update." };
  }

  for (let i = 0; i < input.rounds.length; i++) {
    const round = input.rounds[i];
    const { date, time } = round;

    if (!date || !time) {
      return { error: `Round ${i + 1}: date and time are required.` };
    }

    const offset = getParisOffset(date);
    const opensAt = `${date}T${time}:00${offset}`;

    // closes_at = next round's opens_at, or same day 23:59:59 if last round
    let closesAt: string;
    const next = input.rounds[i + 1];
    if (next) {
      const nextOffset = getParisOffset(next.date);
      closesAt = `${next.date}T${next.time}:00${nextOffset}`;
    } else {
      closesAt = `${date}T23:59:59${offset}`;
    }

    const { error: updateError } = await supabase
      .from("auctions")
      .update({ opens_at: opensAt, closes_at: closesAt })
      .eq("id", round.id);

    if (updateError) {
      return { error: `Failed to update Round ${i + 1}.` };
    }
  }

  revalidatePath(`/league/${input.leagueId}/team/auctions`);
  revalidatePath(`/league/${input.leagueId}/team/auctions/rounds`);
  return { success: true };
}
