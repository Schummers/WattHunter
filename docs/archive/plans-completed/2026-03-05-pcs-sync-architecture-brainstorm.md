# PCS Sync Architecture — Brainstorm & Décisions

**Date:** 5 mars 2026
**Statut:** En cours de validation

---

## Résumé de la discussion

L'utilisateur a demandé si le pipeline PCS fonctionnait. Investigation complète menée : lecture du code, analyse des logs GitHub Actions, tests locaux. Résultat : le pipeline ne fonctionnait pas du tout. Refonte en direct, tests itératifs, puis brainstorm pour valider la stratégie globale avant de continuer.

---

## Chronologie de la session

### 1. Diagnostic initial
**Question :** "Le pipeline d'import PCS fonctionne ? Les données arrivent dans Supabase ?"

**Réponse :** Non. Investigation du code (`sync.py`, `run_daily_pipeline.py`, workflows GitHub Actions) + analyse des logs du run du 4 mars.

**Logs GitHub Actions (run du 4 mars) :**
- Setup, pip install, Playwright install → tout OK
- `python run_daily_pipeline.py` → **0 riders synchronisés**
- 4 erreurs `season_results() failed: 'NoneType' object has no attribute 'css'`
- Step A (roster): `total_synced: 0` pour les 5 équipes
- Step B (race results): `synced: 0`
- Step D (scoring): `"No race results today"`

**Cause identifiée :** Cloudflare bloque les IPs datacenter Azure des runners GitHub Actions. Le HTML retourné est la page challenge "Just a moment", pas le vrai contenu PCS. Le code parsait silencieusement du HTML vide → 0 résultats sans erreur apparente.

### 2. Test local (Mac, IP résidentielle)
**Test :** `python3 test_playwright_pcs.py "team/tudor-pro-cycling-team-2026"`

**Résultat :**
- Cloudflare check: **OK** (pas de blocage depuis IP résidentielle)
- Team roster: **30 riders trouvés** (Tudor Pro Cycling)
- Rider profile: **erreur parsing** (`'NoneType' object has no attribute 'text'`)

**Conclusion :** Playwright fonctionne en local. Le problème GitHub Actions = IPs datacenter.

### 3. Test du rider profile isolé
Chaque méthode Rider testée individuellement avec 5s de wait :
- `name()` → OK : `'Julian Alaphilippe'`
- `nationality()` → OK : `'FR'`
- `birthdate()` → OK : `'1992-6-11'`
- `points_per_speciality()` → OK : `{'one_day_races': 6977, 'climber': 5583, ...}`
- `season_results()` → OK : liste de résultats
- `image_url()` → OK

**L'erreur du test précédent venait du wait time trop court (3s vs 5s nécessaires).**

### 4. Premier run du pipeline complet — Échec par rate limiting
**Commande :** `python3 run_daily_pipeline.py --roster` (version originale, fetch chaque rider individuellement)

**Résultat :** Tudor 30 riders trouvés via `team.riders()`, mais les 30 pages rider individuelles → Cloudflare rate-limit. Puis les 4 équipes suivantes bloquées aussi.

**Diagnostic :** 30 pages × 9s = 4.5 min de navigation automatisée → Cloudflare détecte le pattern et bloque.

### 5. Refonte : team-only fetch
**Solution :** Ne plus fetcher les pages rider individuelles. `team.riders()` retourne déjà nom, nationalité, âge, points, ranking. On perd specialty et photo_url (secondaires).

**Résultat après refonte + 60s cooldown :**
```
Tudor: 30 riders ✅
Cofidis: 30 riders ✅
Q365: 30 riders ✅
TotalEnergies: 28 riders ✅
Caja Rural: 26 riders ✅
Total: 144 riders, 0 erreurs
```

**Clés du succès :** fresh browser context par équipe + 15s pause entre chaque.

### 6. Question du scoring (Pipeline 2)
**Doute de l'utilisateur :** "Et pour l'autre pipeline, les points PCS après une course ?"

**Problème identifié :** `sync_race_results()` original fetchait les pages rider individuelles (rate-limited). J'ai commencé à réécrire avec un diff de `ranking_points` jour-par-jour, mais l'utilisateur a freiné → **brainstorm**.

**Pourquoi le diff de ranking_points ne marche pas :**
- `ranking_points` = total sur 12 mois glissants
- Rider gagne 100 pts + 50 pts expirent le même jour → diff = +50, pas +100
- Pas fiable pour le scoring du jeu

### 7. Brainstorm — Idée de l'utilisateur
**"On peut utiliser les pages des courses elles-mêmes, pas les pages des coureurs"**

Exemple : `https://www.procyclingstats.com/race/omloop-het-nieuwsblad/2026/result`

**Test concluant :** `procyclingstats.Stage.results()` retourne 175 résultats avec `rider_url`, `pcs_points`, `uci_points`, `rank`, `team_url` en une seule page.

---

## Décisions prises ✅

| # | Sujet | Décision |
|---|---|---|
| 1 | Exécution du sync | **Locale uniquement** (Mac, IP résidentielle) |
| 2 | GitHub Actions | **Supprimés** (Cloudflare bloque les IPs datacenter) |
| 3 | Roster sync (Pipeline 1) | **Fonctionne** — 5 pages team, 144 riders, ~2 min |
| 4 | Pages rider individuelles | **Non** — rate-limited, pas nécessaire |
| 5 | Source des points de course | **Pages de résultat de course** (1 page = tous les résultats) |
| 6 | Métrique de scoring | **pcs_points** (pas uci_points) |
| 7 | Périmètre courses | **Calendrier World Tour** (depuis races.php) |
| 8 | Gestion du calendrier | **Scrappé une fois**, stocké, rafraîchi manuellement |
| 9 | Automatisation | **Manuelle** pour la bêta |

---

## À trancher 🔶

### 1. Architecture du pipeline de course (proposée, pas encore validée)

```
Étape A — Roster Sync (existant ✅)
  Playwright → 5 pages team → upsert riders

Étape B — Race Results Import (à implémenter)
  1. Lit le calendrier (race_calendar.json ou table Supabase ?)
  2. Filtre les courses terminées depuis le dernier run
  3. Playwright → 1 page résultat par course terminée
  4. Match rider_url avec riders.pcs_slug
  5. Upsert rider_pcs_history (rider_id, date_course, pcs_points)

Étape C — Scoring (existant, ajuster si besoin)
  Lit rider_pcs_history → calcule XP + revenue → met à jour teams
```

### 2. Stockage du calendrier
- Fichier JSON local (`race_calendar.json`) ?
- Table Supabase (`race_calendar`) ?
- Fichier dans le repo ?

### 3. Courses par étapes (grands tours, courses à étapes)
- Paris-Nice, Tour de France, etc. → une page résultat par étape
- `Race.stages()` peut lister les étapes
- Le script doit-il détecter auto les étapes ou on les liste manuellement ?

### 4. Fréquence et timing
- Quand lancer ? Le soir après les courses ? Le lendemain matin ?
- PCS publie les résultats quelques heures après la course
- Si on lance trop tôt, la page résultat n'existe pas encore

### 5. Scoring : ajustements nécessaires ?
- `rider_pcs_history.date` = date de la course (pas date d'import)
- Plusieurs courses le même jour = cumul des points
- Le `CONVERSION_RATE` (500 €/point PCS) est-il toujours le bon barème ?

### 6. Cleanup et commit du code modifié aujourd'hui
Modifications faites mais pas encore commitées :
- `sync.py` : Python 3.9 compat, Cloudflare detection, team-only fetch, sync_race_results réécrit (delta — à remplacer par approche course)
- `main.py` : endpoints legacy supprimés, Python 3.9 compat
- `run_daily_pipeline.py` : dotenv, --roster flag, env check
- `requirements.txt` : procyclingstats 0.2.7 → 0.2.8
- `.env.example` : nettoyé
- `.env` : créé avec clés Supabase
- `.github/workflows/` : 2 fichiers supprimés

---

## Corrections techniques faites aujourd'hui

| Fix | Détail |
|---|---|
| Python 3.9 compat | `from __future__ import annotations` + `Optional[X]` au lieu de `X \| None` |
| Détection Cloudflare | `fetch_html()` lève `RuntimeError` si "Just a moment" détecté |
| Wait time | 3s → 5s pour le chargement des pages |
| Team-only fetch | `team.riders()` au lieu de fetch chaque rider individuellement |
| Fresh context/team | Nouveau browser context + 15s pause entre teams → 0 erreurs CF |
| procyclingstats | 0.2.7 → 0.2.8 |
| `.env.example` | RESEND_API_KEY et SYNC_API_SECRET retirés |
| Endpoints legacy | `sync_rider_daily`, `sync_rider_history` supprimés |

---

## Données techniques de référence

### ProTeams alpha (5 équipes, 144 riders)

| Équipe | Slug PCS | Riders |
|---|---|---|
| Tudor Pro Cycling | `team/tudor-pro-cycling-team-2026` | 30 |
| Cofidis | `team/cofidis-2026` | 30 |
| Pinarello Q365 | `team/pinarello-q365-pro-cycling-team-2026` | 30 |
| TotalEnergies | `team/totalenergies-2026` | 28 |
| Caja Rural | `team/caja-rural-seguros-rga-2026` | 26 |

### Données roster par rider (via team.riders())

`rider_name`, `rider_url`, `nationality`, `age`, `ranking_points`, `ranking_position`, `career_points`

### Données résultat de course (via Stage.results())

`rider_name`, `rider_url`, `pcs_points`, `uci_points`, `rank`, `team_name`, `team_url`, `time`, `age`, `nationality`

### Test Omloop Het Nieuwsblad 2026

Coureurs de nos ProTeams dans les résultats :
- rank 5: De Gendt (Q365) — 80 pcs_points
- rank 8: Turgis (TotalEnergies) — 50 pcs_points
- rank 9: Renard (Cofidis) — 46 pcs_points

### Commande pour lancer le roster sync
```bash
cd services/pcs-sync
python3 run_daily_pipeline.py --roster    # roster uniquement (~2 min)
python3 run_daily_pipeline.py             # pipeline complet (roster + scoring)
```

---

## Prochaine étape

Valider les 6 points ouverts (section "À trancher") puis implémenter le pipeline de course.
