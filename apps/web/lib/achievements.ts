export type AchievementTier = "victory" | "podium" | "top10" | "dynamic"
export type AchievementCategory =
  | "monuments"
  | "monuments-combined"
  | "grand-tours"
  | "budget"
  | "roster"
  | "league"

export interface Achievement {
  slug: string
  category: AchievementCategory
  name: string
  condition: string
  tier: AchievementTier
  badgeUrl: string
  bannerUrl: string
  accentColor: string
}

const monuments = (
  slug: string,
  name: string,
  condition: string,
  tier: AchievementTier,
  accentColor: string
): Achievement => ({
  slug,
  category: "monuments",
  name,
  condition,
  tier,
  badgeUrl: `/achievements/monuments/badge-${slug.replace(/-victory|-podium|-top10/, "")}.webp`,
  bannerUrl: `/achievements/monuments/banner-${slug.replace(/-victory|-podium|-top10/, "")}.webp`,
  accentColor,
})

const mc = (
  slug: string,
  name: string,
  condition: string,
  tier: AchievementTier,
  accentColor: string,
  badgeFile?: string
): Achievement => ({
  slug,
  category: "monuments-combined",
  name,
  condition,
  tier,
  accentColor,
  badgeUrl: `/achievements/monuments-combined/badge-${badgeFile ?? slug}.webp`,
  bannerUrl: `/achievements/monuments-combined/banner-${badgeFile ?? slug}.webp`,
})

const gt = (
  slug: string,
  name: string,
  condition: string,
  tier: AchievementTier,
  accentColor: string,
  folder: string,
  badgeFile: string,
  bannerFile: string
): Achievement => ({
  slug,
  category: "grand-tours",
  name,
  condition,
  tier,
  accentColor,
  badgeUrl: `/achievements/${folder}/${badgeFile}.webp`,
  bannerUrl: `/achievements/${folder}/${bannerFile}.webp`,
})

export const ACHIEVEMENTS: Achievement[] = [
  // ── Group 1 — Monuments Individual ──────────────────────────────────────
  monuments("paris-roubaix-victory", "Hell of the North",     "A rider from your team wins Paris-Roubaix",                    "victory", "#f59e0b"),
  monuments("paris-roubaix-podium",  "Survivor of the North", "A rider from your team finishes top 3 at Paris-Roubaix",       "podium",  "#f59e0b"),
  monuments("paris-roubaix-top10",   "Hell Participant",      "A rider from your team finishes top 10 at Paris-Roubaix",      "top10",   "#f59e0b"),

  monuments("flandres-victory", "Patron of Flanders",   "A rider from your team wins the Tour of Flanders",           "victory", "#eab308"),
  monuments("flandres-podium",  "Soldier of Flanders",  "A rider from your team finishes top 3 at Tour of Flanders",  "podium",  "#eab308"),
  monuments("flandres-top10",   "Flemish Contender",    "A rider from your team finishes top 10 at Tour of Flanders", "top10",   "#eab308"),

  monuments("lbl-victory", "La Doyenne",      "A rider from your team wins Liège-Bastogne-Liège",                   "victory", "#d946ef"),
  monuments("lbl-podium",  "Dame de Bronze",  "A rider from your team finishes top 3 at Liège-Bastogne-Liège",     "podium",  "#d946ef"),
  monuments("lbl-top10",   "Ardennes Raider", "A rider from your team finishes top 10 at Liège-Bastogne-Liège",    "top10",   "#d946ef"),

  monuments("lombardia-victory", "Il Diavolo",      "A rider from your team wins Il Lombardia",                "victory", "#f97316"),
  monuments("lombardia-podium",  "L'Ombre de Côme", "A rider from your team finishes top 3 at Il Lombardia",  "podium",  "#f97316"),
  monuments("lombardia-top10",   "Autumn Racer",    "A rider from your team finishes top 10 at Il Lombardia", "top10",   "#f97316"),

  monuments("milan-sanremo-victory", "Primavera",         "A rider from your team wins Milan-San Remo",                "victory", "#06b6d4"),
  monuments("milan-sanremo-podium",  "Riviera Finisher",  "A rider from your team finishes top 3 at Milan-San Remo",  "podium",  "#06b6d4"),
  monuments("milan-sanremo-top10",   "Poggio Climber",    "A rider from your team finishes top 10 at Milan-San Remo", "top10",   "#06b6d4"),

  // ── Group 2 — Monuments Combined ────────────────────────────────────────
  mc("monuments-collector", "Monument Collector", "A rider from your team finishes top 10 at each of the 5 Monuments in the same season", "top10",   "#6b7280"),
  mc("monuments-hunter",    "Monument Hunter",    "A rider from your team finishes top 5 at 3 or more Monuments in the same season",      "podium",  "#f59e0b", "monuments-collector"),
  mc("monuments-double",    "Double Crown",       "A rider from your team wins 2 distinct Monuments over their career",                    "victory", "#fbbf24"),
  mc("monument-man",        "Monument Man",       "Your team leads the league in cumulative XP across all 5 Monuments",                   "dynamic", "#22d3ee"),
  mc("classic-man",         "Classic Man",        "Your team leads the league in cumulative XP across all one-day WT races",              "dynamic", "#22d3ee"),

  // ── Group 3 — Giro d'Italia ──────────────────────────────────────────────
  gt("giro-gc-victory",     "Maglia Rosa",       "A rider from your team wins the Giro d'Italia GC",              "victory", "#ed5298", "giro", "badge-giro-gc",     "banner-giro-gc-victory"),
  gt("giro-gc-podium",      "Rosa Podium",       "A rider from your team finishes top 3 GC at the Giro d'Italia", "podium",  "#ed5298", "giro", "badge-giro-gc",     "banner-giro-gc-podium"),
  gt("giro-kom-victory",    "Maglia Azzurra",    "A rider from your team wins the KOM jersey at the Giro d'Italia",    "victory", "#4a90e2", "giro", "badge-giro-kom",    "banner-giro-kom-victory"),
  gt("giro-points-victory", "Maglia Ciclamino",  "A rider from your team wins the Points jersey at the Giro d'Italia", "victory", "#d83cab", "giro", "badge-giro-points", "banner-giro-points-victory"),
]

export function getAchievementBySlug(slug: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.slug === slug)
}

export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.category === category)
}
