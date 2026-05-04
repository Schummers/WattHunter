"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  rounds: { id: string; date: string; time: string; closingTime?: string }[];
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

    let closesAt: string;
    const next = input.rounds[i + 1];
    if (next) {
      const nextOffset = getParisOffset(next.date);
      closesAt = `${next.date}T${next.time}:00${nextOffset}`;
    } else {
      const ct = round.closingTime ?? "23:59";
      closesAt = `${date}T${ct}:00${offset}`;
    }

    const { error: updateError } = await supabase
      .from("auctions")
      .update({ opens_at: opensAt, closes_at: closesAt })
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
  rounds: { date: string; time: string; closingTime?: string }[];
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

  const rows = input.rounds.map((round, i) => {
    const offset = getParisOffset(round.date);
    const opensAt = `${round.date}T${round.time}:00${offset}`;
    let closesAt: string;
    const next = input.rounds[i + 1];
    if (next) {
      const nextOffset = getParisOffset(next.date);
      closesAt = `${next.date}T${next.time}:00${nextOffset}`;
    } else {
      const ct = round.closingTime ?? "23:59";
      closesAt = `${round.date}T${ct}:00${offset}`;
    }
    return {
      league_id: input.leagueId,
      name: `Round ${i + 1}`,
      status: i === 0 ? "open" : "scheduled",
      opens_at: opensAt,
      closes_at: closesAt,
    };
  });

  const { error: insertError } = await supabase.from("auctions").insert(rows);
  if (insertError) return { error: "Failed to create auction rounds." };

  revalidatePath(`/league/${input.leagueId}/auction`);
  revalidatePath(`/league/${input.leagueId}/auction/rounds`);
  return { success: true };
}
