# PCS Sync — Design Document

**Date:** 5 mars 2026
**Statut:** Validé

---

## Contexte

WattHunter est un jeu de gestion d'équipe cycliste. Les joueurs recrutent des coureurs professionnels via des enchères et gagnent des points/argent en fonction des performances réelles des coureurs sur les courses World Tour.

Le service `pcs-sync` scrape procyclingstats.com (PCS) via Playwright pour alimenter la base Supabase avec les données coureurs, résultats et classements.

**Contrainte principale :** Cloudflare bloque les IPs datacenter → exécution locale uniquement (IP résidentielle).

---

## Architecture : 3 Pipelines

### Pipeline A — Init Riders (annuel)

**Quand :** 1x par an, en début de saison.
**But :** Importer tous les coureurs des 9 ProTeams + les classements des 3 dernières saisons.

```
1. Roster sync
   - Playwright → 9 pages Team → ~260 riders
   - Données: full_name, pcs_slug, nationality, age, real_team, pcs_points_1yr, pcs_rank
   - Upsert table `riders` (on_conflict: pcs_slug)
   - Fresh browser context/team + 15s pause (~4 min)

2. Season rankings (2024, 2025, 2026)
   - Playwright → 3 pages Ranking (rankings/me/season-individual/YYYY-12-31)
   - Données: rider_url, points, rank par saison
   - Filtrer par nos riders (match rider_url ↔ pcs_slug)
   - Upsert table `rider_season_rankings` (rider_id, season, points, rank)
```

**9 ProTeams beta :**

| Équipe | Slug PCS |
|--------|----------|
| Tudor Pro Cycling | `team/tudor-pro-cycling-team-2026` |
| Cofidis | `team/cofidis-2026` |
| Pinarello Q365 | `team/pinarello-q365-pro-cycling-team-2026` |
| TotalEnergies | `team/totalenergies-2026` |
| Caja Rural | `team/caja-rural-seguros-rga-2026` |
| Uno-X Mobility | `team/uno-x-mobility-2026` |
| XDS Astana | `team/xds-astana-team-2026` |
| Lotto-Intermarché | `team/lotto-intermarche-2026` |
| NSN Cycling | `team/nsn-cycling-team-2026` |

**Filtrage riders :** Aucun. Tous les riders des 9 équipes sont jouables. L'UI trie par points PCS décroissants.

---

### Pipeline B — Post-Race (après chaque course/étape WT)

**Quand :** Après chaque course ou étape World Tour terminée (manuellement pour la beta).
**But :** Importer les résultats de course + mettre à jour le ranking global.

```
1. Race results import
   - Input: URL de la course/étape (ex: race/paris-nice/2026/stage-3)
   - Pour courses par étapes: Race.stages() → liste des stage_url
   - Pour classiques: directement la page /result
   - Playwright → Stage.results() → pcs_points par coureur
   - Match rider_url avec riders.pcs_slug
   - Upsert table `race_results` (rider_id, race_slug, stage, date, pcs_points, rank)

2. Ranking global update
   - Playwright → 1 page Ranking (rankings/me/individual)
   - Met à jour riders.pcs_points_1yr et riders.pcs_rank
   - Recalcule monthly_salary pour tous les riders

3. Scoring jeu
   - Lit les race_results du jour
   - Pour chaque rider sous contrat: pcs_points × CONVERSION_RATE → treasury
   - Calcule XP gagné
   - Met à jour les équipes des joueurs
```

**Courses par étapes :**
- Le script détecte auto via `Race.is_one_day_race()`
- Si course à étapes → `Race.stages()` retourne la liste des `stage_url`
- On fetch chaque étape individuellement avec `Stage.results()`
- Chaque étape a ses propres pcs_points

---

### Pipeline C — Startlists (avant enchères / avant courses)

**Quand :** 3 jours avant les enchères + 2 jours avant chaque course WT.
**But :** Permettre aux joueurs de voir le programme prévisionnel des coureurs.

```
1. Startlist import
   - Input: URL de la course (ex: race/paris-nice/2026/startlist)
   - Playwright → RaceStartlist.startlist()
   - Données: rider_url, rider_name, team_name, rider_number
   - Match rider_url avec riders.pcs_slug
   - Upsert table `race_startlists` (rider_id, race_slug, race_name, race_date)
```

**Usage produit :** Sur la fiche coureur, le joueur voit "Prochaines courses : Paris-Nice, Milan-San Remo, Tour des Flandres" → aide à évaluer la valeur en enchère.

---

## Sources de données PCS

| Classe procyclingstats | URL pattern | Données | Usage |
|----------------------|-------------|---------|-------|
| `Team` | `team/cofidis-2026` | roster complet | Pipeline A |
| `Ranking` | `rankings/me/season-individual/YYYY-12-31` | points + rank par saison | Pipeline A |
| `Ranking` | `rankings/me/individual` | ranking 12 mois glissant | Pipeline B |
| `Stage` | `race/xxx/2026/result` ou `race/xxx/2026/stage-N` | pcs_points par coureur | Pipeline B |
| `Race` | `race/xxx/2026` | liste des étapes (stage races) | Pipeline B |
| `RaceStartlist` | `race/xxx/2026/startlist` | participants inscrits | Pipeline C |

---

## Tables Supabase (nouvelles ou modifiées)

### `rider_season_rankings` (nouvelle)
```sql
rider_id       UUID REFERENCES riders(id)
season         INT          -- 2024, 2025, 2026
points         INT          -- PCS points pour cette saison
rank           INT          -- classement PCS pour cette saison
PRIMARY KEY (rider_id, season)
```

### `race_results` (nouvelle, remplace rider_pcs_history)
```sql
id             UUID DEFAULT gen_random_uuid()
rider_id       UUID REFERENCES riders(id)
race_slug      TEXT         -- "race/paris-nice/2026/stage-3"
race_name      TEXT         -- "Paris-Nice - Stage 3"
stage          TEXT NULL     -- "stage-3" ou NULL pour classiques
race_date      DATE         -- date de la course/étape
pcs_points     INT          -- points PCS gagnés
rank           INT          -- classement dans la course
UNIQUE (rider_id, race_slug)
```

### `race_startlists` (nouvelle)
```sql
rider_id       UUID REFERENCES riders(id)
race_slug      TEXT         -- "race/paris-nice/2026"
race_name      TEXT         -- "Paris-Nice"
race_date      DATE         -- date de début de la course
PRIMARY KEY (rider_id, race_slug)
```

### `riders` (existante, colonnes inchangées)
- `pcs_points_1yr` et `pcs_rank` mis à jour par Pipeline B
- `monthly_salary` recalculé après chaque course

---

## Calendrier World Tour

Le calendrier WT est stocké en **fichier JSON dans le repo** (`services/pcs-sync/wt_calendar_2026.json`). Format :

```json
[
  {
    "slug": "race/omloop-het-nieuwsblad/2026",
    "name": "Omloop Het Nieuwsblad",
    "date": "2026-03-01",
    "type": "one-day"
  },
  {
    "slug": "race/paris-nice/2026",
    "name": "Paris-Nice",
    "start_date": "2026-03-08",
    "end_date": "2026-03-15",
    "type": "stage-race"
  }
]
```

**Pourquoi fichier JSON et pas table Supabase :** Le calendrier WT est stable pour toute la saison (~35 courses). Un fichier est plus simple à éditer manuellement et ne nécessite pas de migration.

---

## Exécution

Tout est lancé manuellement via CLI pour la beta :

```bash
cd services/pcs-sync

# Pipeline A — Init riders (1x/an)
python3 run_pipeline.py init-riders

# Pipeline B — Post-race (après chaque course/étape)
python3 run_pipeline.py post-race --race "race/paris-nice/2026/stage-3"
python3 run_pipeline.py post-race --race "race/omloop-het-nieuwsblad/2026"

# Pipeline C — Startlists (avant enchères/courses)
python3 run_pipeline.py startlists --race "race/paris-nice/2026"
```

**Durée estimée :**
- Init riders : ~5 min (9 teams + 3 rankings)
- Post-race : ~30s (1 résultat + 1 ranking)
- Startlists : ~15s (1 page)

---

## Décisions techniques

| # | Sujet | Décision |
|---|-------|----------|
| 1 | Exécution | Locale uniquement (IP résidentielle, Cloudflare) |
| 2 | Fréquence roster | Annuel (pas daily) |
| 3 | Source résultats | Pages de course (`Stage.results()`), pas pages rider |
| 4 | Métrique scoring | `pcs_points` (pas `uci_points`) |
| 5 | Périmètre courses | Calendrier World Tour |
| 6 | Stockage calendrier | Fichier JSON dans le repo |
| 7 | Courses par étapes | Auto-détecté via `Race.is_one_day_race()` + `Race.stages()` |
| 8 | Filtrage riders | Aucun — tous les riders des 9 ProTeams jouables |
| 9 | Season rankings | 3 dernières saisons (2024-2026) |
| 10 | Spécialités/photos | Futur (pas beta) |
| 11 | Ranking global | Mis à jour post-race (1 page ranking) |

---

## Futur (post-beta)

- **Photos riders** : nécessite fetch page rider individuelle, à planifier avec rate limiting
- **Spécialités** : rankings par spécialité (`season-individual-gc`, `season-individual-one-day`, etc.)
- **Automatisation** : cron local ou service dédié
- **WorldTeams** : ajout d'équipes WorldTour → paliers de déblocage par niveau d'équipe
