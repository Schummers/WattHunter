export type AchievementTier = "victory" | "podium" | "top10" | "dynamic"
export type AchievementCategory = "monuments" | "budget" | "roster" | "league"

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
  badgeUrl: `/achievements/monuments/badge-${slug.replace(/-victory|-podium|-top10/, "")}.png`,
  bannerUrl: `/achievements/monuments/banner-${slug.replace(/-victory|-podium|-top10/, "")}.png`,
  accentColor,
})

export const ACHIEVEMENTS: Achievement[] = [
  // Paris-Roubaix
  monuments("paris-roubaix-victory", "Hell of the North",     "A rider from your team wins Paris-Roubaix",                    "victory", "#f59e0b"),
  monuments("paris-roubaix-podium",  "Survivor of the North", "A rider from your team finishes top 3 at Paris-Roubaix",       "podium",  "#f59e0b"),
  monuments("paris-roubaix-top10",   "Hell Participant",      "A rider from your team finishes top 10 at Paris-Roubaix",      "top10",   "#f59e0b"),

  // Tour des Flandres
  monuments("flandres-victory", "Patron of Flanders",   "A rider from your team wins the Tour of Flanders",           "victory", "#eab308"),
  monuments("flandres-podium",  "Soldier of Flanders",  "A rider from your team finishes top 3 at Tour of Flanders",  "podium",  "#eab308"),
  monuments("flandres-top10",   "Flemish Contender",    "A rider from your team finishes top 10 at Tour of Flanders", "top10",   "#eab308"),

  // Liège-Bastogne-Liège
  monuments("lbl-victory", "La Doyenne",      "A rider from your team wins Liège-Bastogne-Liège",                   "victory", "#d946ef"),
  monuments("lbl-podium",  "Dame de Bronze",  "A rider from your team finishes top 3 at Liège-Bastogne-Liège",     "podium",  "#d946ef"),
  monuments("lbl-top10",   "Ardennes Raider", "A rider from your team finishes top 10 at Liège-Bastogne-Liège",    "top10",   "#d946ef"),

  // Il Lombardia
  monuments("lombardia-victory", "Il Diavolo",      "A rider from your team wins Il Lombardia",                "victory", "#f97316"),
  monuments("lombardia-podium",  "L'Ombre de Côme", "A rider from your team finishes top 3 at Il Lombardia",  "podium",  "#f97316"),
  monuments("lombardia-top10",   "Autumn Racer",    "A rider from your team finishes top 10 at Il Lombardia", "top10",   "#f97316"),

  // Milan-San Remo
  monuments("milan-sanremo-victory", "Primavera",         "A rider from your team wins Milan-San Remo",                "victory", "#06b6d4"),
  monuments("milan-sanremo-podium",  "Riviera Finisher",  "A rider from your team finishes top 3 at Milan-San Remo",  "podium",  "#06b6d4"),
  monuments("milan-sanremo-top10",   "Poggio Climber",    "A rider from your team finishes top 10 at Milan-San Remo", "top10",   "#06b6d4"),
]

export function getAchievementBySlug(slug: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.slug === slug)
}

export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.category === category)
}
