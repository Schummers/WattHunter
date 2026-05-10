/**
 * World Tour 2026 parent race slugs — used to filter out non-WT races
 * from the race feed. Derived from services/pcs-sync/wt_calendar_2026.json.
 *
 * For stage races:  parent slug = race/{name}/{year}   (e.g. race/giro-d-italia/2026)
 * For one-day races: slug itself  = race/{name}/{year}  (e.g. race/paris-roubaix/2026)
 */
export const WT_PARENT_SLUGS = new Set([
  "race/tour-down-under/2026",
  "race/great-ocean-road-race/2026",
  "race/uae-tour/2026",
  "race/omloop-het-nieuwsblad/2026",
  "race/strade-bianche/2026",
  "race/paris-nice/2026",
  "race/tirreno-adriatico/2026",
  "race/milano-sanremo/2026",
  "race/volta-a-catalunya/2026",
  "race/classic-brugge-de-panne/2026",
  "race/e3-harelbeke/2026",
  "race/gent-wevelgem/2026",
  "race/dwars-door-vlaanderen/2026",
  "race/ronde-van-vlaanderen/2026",
  "race/itzulia-basque-country/2026",
  "race/paris-roubaix/2026",
  "race/amstel-gold-race/2026",
  "race/la-fleche-wallonne/2026",
  "race/liege-bastogne-liege/2026",
  "race/tour-de-romandie/2026",
  "race/eschborn-frankfurt/2026",
  "race/giro-d-italia/2026",
  "race/dauphine/2026",
  "race/tour-de-suisse/2026",
  "race/copenhagen-sprint/2026",
  "race/tour-de-france/2026",
  "race/san-sebastian/2026",
  "race/tour-de-pologne/2026",
  "race/cyclassics-hamburg/2026",
  "race/renewi-tour/2026",
  "race/vuelta-a-espana/2026",
  "race/bretagne-classic/2026",
  "race/gp-quebec/2026",
  "race/gp-montreal/2026",
  "race/il-lombardia/2026",
  "race/tour-of-guangxi/2026",
]);
