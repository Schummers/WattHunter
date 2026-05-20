# Pipeline E — Enrichissement coureurs (Design)

Date: 2026-03-06

## Objectif

Enrichir les 500 coureurs du top PCS avec des donnees individuelles (photo, bio, specialite, historique equipes, resultats saison) en visitant la page individuelle de chaque coureur sur procyclingstats.com. Execution 1x/an en debut de saison.

## CLI

```bash
python3 run_pipeline.py enrich-riders [--start 401 --end 500]
```

- `--start` / `--end` : rang PCS de debut/fin (defaut: 1-500)
- Permet de tester sur un sous-ensemble avant de lancer le batch complet

## Source de donnees

Page individuelle PCS : `https://www.procyclingstats.com/rider/{slug}`

Utilise `procyclingstats.Rider(url).parse()` et methodes associees (lib v0.2.7).

## Donnees recuperees par coureur

### Colonnes ajoutees a `riders`

| Colonne | Type | Source methode | Notes |
|---|---|---|---|
| `birthdate` | date | `.birthdate()` | Stable, ne change jamais |
| `birth_place` | text | `.place_of_birth()` | Stable |
| `height_cm` | int | `.height()` | Stable |
| `weight_kg` | int | `.weight()` | Rarement change |
| `photo_url` | text | `.image_url()` | Existe deja dans schema, pas rempli |
| `specialty` | text | `.points_per_speciality()` | Existe deja, calcule via max(GC, OneDay, TT, Sprint) |

### Nouvelle table `rider_teams`

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `rider_id` | uuid FK -> riders | ON DELETE CASCADE |
| `team_name` | text NOT NULL | |
| `team_url` | text | |
| `season` | int NOT NULL | ex: 2026 |
| UNIQUE | | (rider_id, team_url, season) |

Source : `.teams_history()` -> list of {team_url, team_name, season}

### Nouvelle table `rider_season_points`

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `rider_id` | uuid FK -> riders | ON DELETE CASCADE |
| `season` | int NOT NULL | |
| `points` | int NOT NULL | |
| UNIQUE | | (rider_id, season) |

Source : `.points_per_season_history()` -> list of {season, points}

### Nouvelle table `rider_race_results`

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `rider_id` | uuid FK -> riders | ON DELETE CASCADE |
| `race_name` | text NOT NULL | |
| `race_url` | text NOT NULL | |
| `date` | date | |
| `result` | text | Position ou DNF/DNS |
| `pcs_points` | int DEFAULT 0 | Points gagnes sur cette course |
| `season` | int NOT NULL | Annee en cours |
| UNIQUE | | (rider_id, race_url) |

Source initiale : `.season_results()` (Pipeline E)
Mise a jour incrementale : Pipeline B (post-race) — upsert sur `rider_id + race_url`

## Logique de specialite

```python
SPECIALTIES_MAP = {"GC": "GC", "One day races": "OneDay", "Time trial": "TT", "Sprint": "Sprint"}

def assign_specialty(points_per_speciality: dict) -> str:
    filtered = {k: v for k, v in points_per_speciality.items() if k in SPECIALTIES_MAP}
    if not filtered:
        return "all_rounder"
    best = max(filtered, key=filtered.get)
    return SPECIALTIES_MAP[best]
```

Valeurs possibles dans `riders.specialty` : `GC`, `OneDay`, `TT`, `Sprint`, `all_rounder`

Note : les points "Climber" et "Hills" sont ignores pour l'assignation.

## Strategie de scraping

- **5 coureurs sequentiels** (~25s chacun : 4s pre-delay + 6s chargement + 15s pause)
- **1 minute de pause** entre chaque batch de 5
- Fresh browser context par coureur
- Cloudflare markers detection (meme logique que sync_top500)
- Reprise possible : si le script crash, relancer avec `--start` au rang ou il s'est arrete

### Timing estime

| Scope | Batches | Duree |
|---|---|---|
| 100 coureurs (test 401-500) | 20 | ~1h |
| 500 coureurs (complet) | 100 | ~5h |

## Modifications aux pipelines existants

### Pipeline B (post-race) — modification

Apres avoir importe les resultats d'une course, Pipeline B doit aussi **upsert dans `rider_race_results`** les resultats des coureurs concernes. Cle d'upsert : `rider_id + race_url`.

### Pipeline A (init-riders) — pas de modification

Le Step 2 (3 pages season rankings) est **conserve en parallele** pour l'instant. Sera supprime une fois Pipeline E valide en production.

## Schema DB — Migration

Fichier : `supabase/migrations/YYYYMMDDHHMMSS_enrich_riders.sql`

- ALTER TABLE riders ADD COLUMN birthdate, birth_place, height_cm, weight_kg
- UPDATE riders.specialty CHECK constraint pour accepter les nouvelles valeurs
- CREATE TABLE rider_teams
- CREATE TABLE rider_season_points
- CREATE TABLE rider_race_results
- RLS : lecture publique (anon), ecriture service_role uniquement

## Fichiers impactes

| Fichier | Action |
|---|---|
| `services/pcs-sync/run_pipeline.py` | Ajouter commande `enrich-riders` |
| `services/pcs-sync/enrich.py` | Nouveau — logique de scraping individuel |
| `services/pcs-sync/sync_race.py` | Modifier — upsert dans rider_race_results apres import course |
| `supabase/migrations/XXXX_enrich_riders.sql` | Nouveau — schema |
