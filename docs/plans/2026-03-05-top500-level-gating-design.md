# WattHunter — Top 500 & Level Gating Design

> Validé le 2026-03-05. Source de vérité pour le pool de riders et le système de niveaux.

## Vue d'ensemble

Le jeu se concentre sur les **500 meilleurs coureurs au monde** selon le ranking PCS individuel (12 mois glissants). Le concept de "9 ProTeams" disparaît — tous les teams sont représentés (UAE, Visma, Lidl-Trek, Cofidis, etc.).

Les riders sont débloqués progressivement par paliers liés au niveau du joueur. Les niveaux bas débloquent les riders les moins bien classés (pépites), les niveaux hauts débloquent les stars mondiales.

### Objectif stratégique

- **Early game** : les joueurs n'ont accès qu'aux riders #401-500 — des coureurs solides mais pas chers, parfaits pour la stratégie "pépites"
- **Mid game** : les riders #101-300 deviennent disponibles — des coureurs reconnus avec de vrais points
- **End game** : les top 10 mondiaux (Pogačar, Evenepoel, Vingegaard) sont le graal ultime
- **Anti-snowball** : impossible d'avoir les meilleurs riders sans avoir monté en level, ce qui prend des mois

---

## 1. Pool de riders : Top 500 PCS Global

### Source de données

- **Ranking PCS individuel** : `rankings.php?p=me&s=individual&offset=N&filter=Filter`
- **5 pages** de 100 riders (offsets 0, 100, 200, 300, 400)
- **Données par rider** : nom, team, points PCS, rang PCS
- L'âge, nationalité, spécialité ne sont PAS scrapés pour la beta (viendront plus tard)

### Mise à jour

- Scrapé après chaque course WT (Pipeline B `post-race`)
- Fresh browser context par page + 11s pause entre pages
- Upsert dans la table `riders` avec `pcs_slug` comme clé de conflit

### Nettoyage

- Les riders des 9 ProTeams hors top 500 sont **supprimés** du pool jouable
- Le Pipeline A `init-riders` (roster sync des 9 ProTeams) est **remplacé** par le scrape top 500
- `PROTEAM_SLUGS` dans sync.py n'est plus utilisé pour le pool de riders

### Règles de persistance

- **Un rider entre dans le top 500** → il est ajouté au pool (jouable au level correspondant à son rang)
- **Un rider sort du top 500** → il **reste dans le pool** (jamais retiré)
- **Un rider monte dans le ranking** (ex: #400 → #50) → il **reste jouable** pour ceux qui l'avaient déjà débloqué. Il n'est pas rebloqué.
- **Colonne `ever_in_top500`** (BOOLEAN) : marqué TRUE la première fois qu'un rider entre dans le top 500. Jamais remis à FALSE.

---

## 2. Paliers de déblocage par level

| Level | Rang PCS débloqué | Nouveaux riders | Cumulé |
|---|---|---|---|
| 1 | #401 → #500 | 100 | 100 |
| 2 | #301 → #400 | 100 | 200 |
| 3 | #201 → #300 | 100 | 300 |
| 4 | #151 → #200 | 50 | 350 |
| 5 | #101 → #150 | 50 | 400 |
| 6 | #76 → #100 | 25 | 425 |
| 7 | #51 → #75 | 25 | 450 |
| 8 | #26 → #50 | 25 | 475 |
| 9 | #11 → #25 | 15 | 490 |
| 10 | #1 → #10 | 10 | 500 |

### Formule

```
rank_max_for_level(level) =
  level 1  → 500
  level 2  → 400
  level 3  → 300
  level 4  → 200
  level 5  → 150
  level 6  → 100
  level 7  → 75
  level 8  → 50
  level 9  → 25
  level 10 → 10
```

Un rider est jouable si : `rider.pcs_rank <= rank_max_for_level(team.level)` OU `rider.ever_unlocked_by_team = TRUE` (persistance).

### Persistance par joueur

Si un rider était jouable pour un joueur (via son level au moment de l'accès), il le reste même si :
- Le rider monte dans le ranking (rank plus bas = plus fort)
- Le rider sort du top 500

Implémentation : colonne `ever_in_top500` sur `riders` + la vérification se fait au moment de l'enchère, pas du listing.

---

## 3. Courbe XP

### Objectif temporel

- **Level 5 en ~2 mois** (joueur actif)
- **Level 10 en ~9 mois** (joueur très actif)

### Seuils XP cumulés

| Level | XP cumulé requis | XP pour ce level | Temps estimé |
|---|---|---|---|
| 1 | 0 | — | Jour 1 |
| 2 | 1 000 | 1 000 | ~2 semaines |
| 3 | 3 000 | 2 000 | ~1 mois |
| 4 | 6 000 | 3 000 | ~6 semaines |
| 5 | 10 000 | 4 000 | ~2 mois |
| 6 | 18 000 | 8 000 | ~3.5 mois |
| 7 | 30 000 | 12 000 | ~5 mois |
| 8 | 50 000 | 20 000 | ~6.5 mois |
| 9 | 80 000 | 30 000 | ~8 mois |
| 10 | 120 000 | 40 000 | ~9 mois |

### Anti-steamroll

- L'écart entre level 5 (10K XP) et level 10 (120K XP) est de **12×**
- Les levels 1-5 se font rapidement (accrocher le joueur)
- Les levels 6-10 sont longs (empêcher les hardcores de dominer trop vite)
- L'économie beta (enchère = salaire mensuel) freine naturellement : les stars coûtent cher, limitant le nombre de riders forts dans l'équipe

---

## 4. Impact sur le scraping

### Avant (9 ProTeams)

| Pipeline | Action | Fréquence |
|---|---|---|
| A `init-riders` | Scrape roster 9 ProTeams | 1×/an |
| B `post-race` | Résultats + ranking top 300 | Après chaque course |

### Après (Top 500)

| Pipeline | Action | Fréquence |
|---|---|---|
| A `init-riders` | **Scrape top 500 PCS** (5 pages) | 1×/an + après chaque course |
| B `post-race` | Résultats + **mise à jour top 500** | Après chaque course |

Pipeline A change de rôle : au lieu de scraper les rosters d'équipes, il scrape les 5 pages du ranking PCS global et upsert les 500 riders.

Pipeline B inclut toujours `update_global_ranking()` qui met à jour les points/rangs des riders existants — mais maintenant avec 5 pages au lieu de 3.

---

## 5. Impact sur la base de données

### Table `riders`

Nouvelles colonnes :
- `ever_in_top500` (BOOLEAN DEFAULT FALSE) — marqué TRUE quand le rider entre dans le top 500
- `team_type` change de signification — plus de distinction ProTeam/WorldTour, tous les riders sont dans le même pool

Colonnes qui perdent leur utilité :
- `specialty` — pas scrapé depuis le ranking (à remplir plus tard)
- `age` — pas scrapé depuis le ranking
- `nationality` — pas scrapé depuis le ranking (le ranking donne la nationalité, on pourra l'ajouter)

### Table `teams`

- `level` — déjà existant, calculé depuis `cumulative_xp`
- Les seuils XP sont mis à jour (voir section 3)

### Nettoyage

- Supprimer les riders hors top 500 et sans `ever_in_top500 = TRUE`
- Le champ `team_type` n'a plus besoin de filtrage ('ProTeam' vs 'WorldTour')

---

## 6. Impact sur les enchères

### Filtrage des riders dans l'UI

Actuellement :
```typescript
.eq("team_type", "ProTeam")
```

Après :
```typescript
.lte("pcs_rank", rankMaxForLevel(team.level))
.eq("ever_in_top500", true)
```

Fonction helper :
```typescript
function rankMaxForLevel(level: number): number {
  const thresholds = [500, 400, 300, 200, 150, 100, 75, 50, 25, 10];
  return thresholds[Math.min(level, 10) - 1];
}
```

### Validation côté serveur

L'action d'enchère (`actions.ts`) doit vérifier que le rider est bien débloqué pour le level du joueur avant d'accepter l'enchère.

---

## 7. Constantes (résumé)

| Constante | Valeur |
|---|---|
| Pool total | 500 riders (top PCS global) |
| Pages scrapées | 5 (offsets 0-400) |
| Level 1 déblocage | #401-500 |
| Level 10 déblocage | #1-10 |
| XP Level 5 | 10 000 |
| XP Level 10 | 120 000 |
| Persistance rider | Jamais retiré du pool une fois ajouté |

---

## 8. Changements vs documentation existante

| Document | Changement |
|---|---|
| GAME_RULES.md §3 | Pool = top 500 PCS global (plus 9 ProTeams) |
| GAME_RULES.md §8 | Paliers de déblocage par level |
| GAME_RULES.md §10 | Nouveaux seuils XP |
| CLAUDE.md | Pipeline A = scrape top 500, plus roster sync |
| CLAUDE.md | Supprimer `PROTEAM_SLUGS` |
| sync.py | `sync_all_riders()` remplacé par `sync_top500()` |
| sync_race.py | `update_global_ranking()` → 5 pages |
| run_pipeline.py | Pipeline A = top 500 scrape |
| auction UI | Filtrage par level + pcs_rank |

---

## 9. TODO post-beta

- [ ] Ajouter âge/nationalité/spécialité depuis les profils individuels PCS
- [ ] Calibrer les seuils XP après retour des premiers joueurs
- [ ] Ajouter UI "riders verrouillés" (montrer les riders inaccessibles en grisé avec le level requis)
- [ ] Investiguer si on peut aller au-delà de 500 (top 1000 ?)
