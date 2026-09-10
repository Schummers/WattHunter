# 02 — Scraper et stocker les côtes et sprints intermédiaires

Status: `done` (2026-08-28 — table `stage_event_results` en prod, import câblé dans
post-race, commande `import-events`, backfill Vuelta étapes 2 et 4 exécuté (29 lignes).
Garde anti-silence p4/p5 livrée avec le fetch scoring, ticket 03. NOTE : backend
nodriver KO avec Chrome 151 (« Failed to connect to browser ») — backfill passé via
`SCRAPER_BACKEND=playwright`, qui marche toujours.)
Created: 2026-08-27
Blocks: `03-event-scoring-terms.md`

## What to build

Après un `post-race` sur une étape de GT, la base contient l'ordre de franchissement
de chaque col classé (catégorie HC/1/2/3/4) et de chaque sprint intermédiaire de
l'étape, coureur par coureur avec son rang. Démontrable : les 3 étapes courues de la
Vuelta 2026 (1, 2, 4) sont peuplées, l'étape 1 (ITT) à raison vide.

## Comment (validé en prototype le 2026-08-27)

- **Côtes** : `Stage.climbs()` de la lib procyclingstats déjà en dépendance —
  renvoie `climb_name`, `category`, et `rank[]` (rider_url, rank, points). Appelé
  sur le HTML déjà fetché par l'import d'étape : zéro requête en plus.
- **Sprints** : pas dans la lib. Parseur maison (~40 lignes, prototypé) : chercher
  les `<h4>` commençant par `Sprint |` dans la page d'étape, parser le tableau qui
  suit (15 rangs, `rider_url` + rang). À loger près du shim scraping existant.
- **Stockage** : une table (`stage_event_results` ou équivalent) : race_slug,
  event_type (`kom`/`sprint`), event_name, category (null pour sprint), rider_id,
  rank. Migration obligatoire (Rule #2). Upsert idempotent sur
  (race_slug, event_type, event_name, rider_id).
- **Garde anti-silence** : une étape p4/p5 sans aucune ligne KOM importée doit
  faire échouer bruyamment le scoring (même pattern que la garde des profils non
  seedés). Un col peut légitimement manquer sur p1/p2/p3 (décision 2026-08-28,
  code review : une vallonnée p3 sans col catégorisé est un cas réel, la garde
  reste p4/p5 seuls).
- **Backfill** : commande relançable sur un slug d'étape → re-fetch + re-import.
  À lancer sur les étapes 2 et 4 de la Vuelta.

## Acceptance criteria

- [ ] `post-race` sur une étape de GT peuple la table événements sans requête HTTP supplémentaire
- [ ] Vuelta 2026 étapes 2 et 4 backfillées ; étape 1 (ITT) vide sans erreur
- [ ] Étape p4/p5 sans données KOM → échec bruyant, pas un score silencieux à 0
- [ ] Coureur hors pool (non mappé) → ligne ignorée sans crash, comptée dans le log d'import

## Blocked by

None — can start immediately (parallèle à 01 et 04).
