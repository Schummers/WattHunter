"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPhase } from "@/lib/phases";

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

/**
 * Build a Paris-local ISO datetime string from a date string (YYYY-MM-DD) and time (HH:mm).
 */
function toParisIso(date: string, time: string): string {
  const offset = getParisOffset(date);
  return `${date}T${time}:00${offset}`;
}

export async function updateRoundDates(input: {
  leagueId: string;
  // Each round: date+time = closes_at for that round (post-Task 8 form shape).
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

    // Only update closes_at — never opens_at (lazy-open relies on the original opens_at).
    const closesAt = toParisIso(date, time);

    const { error: updateError } = await supabase
      .from("auctions")
      .update({ closes_at: closesAt })
      .eq("id", round.id);

    if (updateError) {
      return { error: `Failed to update Round ${i + 1}.` };
    }
  }

  revalidatePath(`/league/${input.leagueId}/auction`);
  revalidatePath(`/league/${input.leagueId}/auction/rounds`);
  return { success: true };
}

export async function createNextPhaseAuctions(input: {
  leagueId: string;
  // Each round: date+time = closes_at for that round (post-Task 8 form shape).
  rounds: { date: string; time: string }[];
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
    .select("id, commissioner_id, status")
    .eq("id", input.leagueId)
    .single();

  if (!league || league.commissioner_id !== user.id) {
    return { error: "Only the Race Director can create auction rounds." };
  }

  if (league.status !== "active") {
    return { error: "League must be active to create new rounds." };
  }

  const { data: existing } = await supabase
    .from("auctions")
    .select("id")
    .eq("league_id", input.leagueId)
    .in("status", ["open", "scheduled"])
    .limit(1);

  if (existing && existing.length > 0) {
    return { error: "Active rounds already exist. Edit them instead." };
  }

  if (!input.rounds || input.rounds.length === 0 || input.rounds.length > 3) {
    return { error: "Configure 1 to 3 rounds." };
  }

  for (const round of input.rounds) {
    if (!round.date || !round.time) {
      return { error: "All rounds require a date and time." };
    }
  }

  // Derive Round 1 opens_at from the current auction phase (auctionDates[0]).
  // This is the canonical phase start date — the lazy-open helper will flip the
  // round to 'open' once opens_at <= now().
  const currentPhase = getCurrentPhase();
  const now = new Date();
  const year = now.getFullYear();
  let round1OpensAt: string;

  if (currentPhase.auctionDates && currentPhase.auctionDates.length > 0) {
    const ad = currentPhase.auctionDates[0];
    const dateStr = `${year}-${String(ad.month).padStart(2, "0")}-${String(ad.day).padStart(2, "0")}`;
    round1OpensAt = toParisIso(dateStr, "00:00");
  } else {
    // Fallback: open immediately (should not happen with valid AUCTION_PHASES data).
    round1OpensAt = now.toISOString();
  }

  // Build closes_at for each round from the form inputs.
  const closesTimes = input.rounds.map((round) =>
    toParisIso(round.date, round.time)
  );

  const rows = input.rounds.map((_, i) => ({
    league_id: input.leagueId,
    name: `Round ${i + 1}`,
    // All rounds start as 'scheduled' — lazy-open handles Round 1,
    // validate_round handles Round 2 and 3.
    status: "scheduled",
    // Round 1: phase start date. Round N+1: closes_at of Round N (placeholder —
    // validate_round will overwrite with now() when it actually opens).
    opens_at: i === 0 ? round1OpensAt : closesTimes[i - 1],
    closes_at: closesTimes[i],
  }));

  const { error: insertError } = await supabase.from("auctions").insert(rows);
  if (insertError) return { error: "Failed to create auction rounds." };

  revalidatePath(`/league/${input.leagueId}/auction`);
  revalidatePath(`/league/${input.leagueId}/auction/rounds`);
  return { success: true };
}
