import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/get-user";
import { redirect } from "next/navigation";
import { AchievementsClient } from "./achievements-client";

// Monument race bases — used to match slugs across all years
const MONUMENT_BASES = [
  { ilike: "race/paris-roubaix/%",           base: "paris-roubaix" },
  { ilike: "race/ronde-van-vlaanderen/%",    base: "flandres" },
  { ilike: "race/liege-bastogne-liege/%",    base: "lbl" },
  { ilike: "race/il-lombardia/%",            base: "lombardia" },
  { ilike: "race/milano-sanremo/%",          base: "milan-sanremo" },
]

function monumentBase(slug: string): string | null {
  for (const { ilike, base } of MONUMENT_BASES) {
    const pattern = new RegExp("^" + ilike.replace(/%/g, ".*") + "$")
    if (pattern.test(slug)) return base
  }
  return null
}

function yearFromSlug(slug: string): number | null {
  const m = slug.match(/\/(\d{4})\//)
  return m ? parseInt(m[1]) : null
}

export default async function AchievementsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  // Team membership + equipped slug
  const { data: membership } = await supabase
    .from("league_members")
    .select("team_id, teams:team_id(equipped_achievement_slug)")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  const team = membership?.teams as { equipped_achievement_slug: string | null } | null;
  const equippedSlug = team?.equipped_achievement_slug ?? null;
  const myTeamId = membership?.team_id ?? null;

  const unlockedSlugs: string[] = [];

  if (!myTeamId) {
    return (
      <AchievementsClient
        leagueId={leagueId}
        equippedSlug={equippedSlug}
        unlockedSlugs={[]}
      />
    );
  }

  // ── Block 1 & 2: Monument Individual + Combined ──────────────────────────
  // Single query across ALL years (fix year-lock)
  const { data: monumentXpRows } = await supabase
    .from("rider_xp_daily")
    .select("race_slug, rider_id")
    .eq("team_id", myTeamId)
    .or(MONUMENT_BASES.map(({ ilike }) => `race_slug.ilike.${ilike}`).join(","))

  const teamRiderByRace = new Map<string, string[]>();
  for (const row of monumentXpRows ?? []) {
    const list = teamRiderByRace.get(row.race_slug) ?? [];
    list.push(row.rider_id);
    teamRiderByRace.set(row.race_slug, list);
  }

  if (teamRiderByRace.size > 0) {
    const allRiderIds = Array.from(new Set(Array.from(teamRiderByRace.values()).flat()));
    const { data: results } = await supabase
      .from("race_results")
      .select("race_slug, rider_id, rank")
      .in("race_slug", Array.from(teamRiderByRace.keys()))
      .in("rider_id", allRiderIds)
      .lte("rank", 10);

    // Group 1 — individual monuments
    for (const r of results ?? []) {
      const base = monumentBase(r.race_slug);
      if (!base || r.rank == null) continue;
      if (!teamRiderByRace.get(r.race_slug)?.includes(r.rider_id)) continue;
      if (r.rank <= 10) unlockedSlugs.push(`${base}-top10`);
      if (r.rank <= 3)  unlockedSlugs.push(`${base}-podium`);
      if (r.rank === 1) unlockedSlugs.push(`${base}-victory`);
    }

    // Group 2 — monuments-double: career wins at ≥2 distinct monuments
    const careerWins = new Set<string>();
    for (const r of results ?? []) {
      if (r.rank !== 1) continue;
      const base = monumentBase(r.race_slug);
      if (base) careerWins.add(base);
    }
    if (careerWins.size >= 2) unlockedSlugs.push("monuments-double");

    // Group 2 — monuments-collector / monuments-hunter: same season
    // Group by year → { year → { base → best rank } }
    const byYear = new Map<number, Map<string, number>>();
    for (const r of results ?? []) {
      const base = monumentBase(r.race_slug);
      const year = yearFromSlug(r.race_slug);
      if (!base || !year || r.rank == null) continue;
      const rank = r.rank;
      const yearMap = byYear.get(year) ?? new Map<string, number>();
      const existing = yearMap.get(base);
      if (existing === undefined || rank < existing) yearMap.set(base, rank);
      byYear.set(year, yearMap);
    }
    for (const [, yearMap] of byYear) {
      const top10Count = Array.from(yearMap.values()).filter((rank) => rank <= 10).length;
      const top5Count  = Array.from(yearMap.values()).filter((rank) => rank <= 5).length;
      if (top10Count >= 5) unlockedSlugs.push("monuments-collector");
      if (top5Count  >= 3) unlockedSlugs.push("monuments-hunter");
    }
  }

  // ── Block 3: Giro GC ────────────────────────────────────────────────────
  // Find riders who scored XP for this team on any Giro stage (ownership proof)
  const { data: giroXpRows } = await supabase
    .from("rider_xp_daily")
    .select("race_slug, rider_id")
    .eq("team_id", myTeamId)
    .ilike("race_slug", "race/giro-d-italia/%/stage-%")

  const giroRiderIds = [...new Set((giroXpRows ?? []).map((r) => r.rider_id))];

  if (giroRiderIds.length > 0) {
    const { data: giroGcResults } = await supabase
      .from("race_results")
      .select("rider_id, rank")
      .ilike("race_slug", "race/giro-d-italia/%/gc")
      .in("rider_id", giroRiderIds)
      .lte("rank", 3);

    for (const r of giroGcResults ?? []) {
      if (r.rank == null) continue;
      if (r.rank === 1) unlockedSlugs.push("giro-gc-victory");
      if (r.rank <= 3)  unlockedSlugs.push("giro-gc-podium");
    }

    // ── Block 4: Giro KOM + Points (gt_daily_classifications, last stage) ──
    // Find the highest stage number for any Giro in the DB
    const { data: giroStages } = await supabase
      .from("gt_daily_classifications")
      .select("race_slug, stage")
      .ilike("race_slug", "race/giro-d-italia/%/stage-%")
      .in("rider_id", giroRiderIds)

    // Group by race year, find max stage per year
    const maxStageByYear = new Map<string, number>();
    for (const row of giroStages ?? []) {
      const m = row.stage?.match(/stage-(\d+)/);
      if (!m) continue;
      const n = parseInt(m[1]);
      const yearMatch = row.race_slug.match(/giro-d-italia\/(\d{4})\//);
      if (!yearMatch) continue;
      const key = yearMatch[1];
      if ((maxStageByYear.get(key) ?? 0) < n) maxStageByYear.set(key, n);
    }

    for (const [year, maxStage] of maxStageByYear) {
      const lastSlug = `race/giro-d-italia/${year}/stage-${maxStage}`;
      const { data: jerseyRows } = await supabase
        .from("gt_daily_classifications")
        .select("rider_id, classification_type, rank")
        .eq("race_slug", lastSlug)
        .in("rider_id", giroRiderIds)
        .eq("rank", 1)
        .in("classification_type", ["kom", "points"]);

      for (const j of jerseyRows ?? []) {
        if (j.classification_type === "kom")    unlockedSlugs.push("giro-kom-victory");
        if (j.classification_type === "points") unlockedSlugs.push("giro-points-victory");
      }
    }
  }

  return (
    <AchievementsClient
      leagueId={leagueId}
      equippedSlug={equippedSlug}
      unlockedSlugs={[...new Set(unlockedSlugs)]}
    />
  );
}
