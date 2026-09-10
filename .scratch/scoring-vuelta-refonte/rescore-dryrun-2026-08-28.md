# Dry-run rescore Vuelta 2026 — 2026-08-28

Script : `services/pcs-sync/scripts/dryrun_vuelta2026_rescore.py` (lecture seule).
Snapshot pré-rescore : `snapshot-pre-rescore.json` (210 lignes `rider_xp_daily`
Vuelta + `cumulative_xp` de toutes les équipes, horodaté).

## Résultat brut

210 lignes stockées, 22 changements, deltas par équipe :

| Équipe | Delta XP |
|---|---|
| bigdaddy | −68.00 (dont −78 = artefact étape 1, voir ci-dessous) |
| Las Chivas Pendejas | −8.54 (dont −7 = artefact étape 1) |
| GoudalEnergies | +1.60 |
| Klimax | +6.00 |
| Peejee | +8.00 |
| Muskatel Muskadji | +11.00 |
| Leopard_Trek | +12.50 |

## Vérifications à la main

- **Pau Miquel (`dd111037`, pcs_rank 357, underdog, étape 4)** : 307.02 → **291.60**
  = 80 × 3.57 + 6. Exactement le cas rapporté par le joueur et le critère
  d'acceptation du ticket 01. ✓
- **Felix Gall (`bdeae060`, climber Klimax, étape 4)** : 111 → **115**
  = 70 (3e) × 1.5 (p4/p5) + 6 (classif) + 4 (Ordino cat 1 rang 3 = 2 × 2 grimpeur ;
  la Comella cat 3 ne paie rien). ✓
- **Van Aert via `4a61c93e` (sprinteur bigdaddy, étape 2)** : +10 de sprint
  = 2e du sprint de Gréoux (5) × 2 sprinteur. ✓

## ⚠️ Artefacts étape 1 — NE PAS rescorer l'étape 1

Les baisses `bigdaddy` étape 1 (33/9/36 → 0) et `Las Chivas b01d221a` (21 → 14)
ne viennent PAS des fixes 01/03 : l'étape 1 est un ITT sans événement, et le fix
underdog n'y change rien. Elles viennent de la reconstruction du squad/rôles au
cutoff 11h CET du 22/08 : le scoring réel de l'étape 1 a été fait avec une
exception de cutoff (cf. mémoire `vuelta2026_stage1_itt_scoring` — squads
verrouillées après le cutoff, situation ensuite régularisée). Un rescore naïf de
l'étape 1 reproduirait exactement le code-drift contre lequel la procédure met en
garde.

**Périmètre recommandé du rescore : étapes 2 et 4 uniquement**, via
`calculate_daily_scores(race_slugs=[stage-2, stage-4], role_cutoff=<11h CET du
jour de chaque étape>)` (un appel par étape), puis diff contre le snapshot.

Deltas attendus sur ce périmètre (2 + 4 seulement) :

| Équipe | Delta attendu |
|---|---|
| bigdaddy | +10.00 |
| Las Chivas Pendejas | −1.54 |
| GoudalEnergies | +1.60 |
| Klimax | +6.00 |
| Peejee | +8.00 |
| Muskatel Muskadji | +11.00 |
| Leopard_Trek | +12.50 |

## Reste à faire (après validation humaine)

1. Prévenir la ligue (les totaux underdog baissent, retour du joueur à l'origine).
2. Lancer le rescore étapes 2 et 4 (role_cutoff par étape).
3. Re-diff contre `snapshot-pre-rescore.json`, expliquer tout écart vs ce dry-run.
4. Vérif manuelle 2 coureurs (Pau Miquel, Gall) + mise à jour mémoire projet.

## Exécution — 2026-08-28 (diff validé par Jonathan)

Rescore lancé : `calculate_daily_scores(race_slugs=[stage-2], role_cutoff=2026-08-23T11:00+02)`
puis idem stage-4 (cutoff 25/08). Résultat :

- 18 lignes `rider_xp_daily` modifiées, **0 sur l'étape 1** (exclue comme décidé).
- Deltas d'équipe strictement identiques au dry-run : Leopard_Trek +12.50,
  Muskatel +11.00, bigdaddy +10.00, Peejee +8.00, Klimax +6.00,
  GoudalEnergies +1.60, Las Chivas −1.54.
- Cohérence vérifiée sur les **26 équipes** (toutes ligues) : delta `cumulative_xp`
  == somme des deltas de lignes, 0 drift. (Les équipes homonymes des autres ligues
  n'ont pas bougé — un premier contrôle par nom les signalait à tort.)
- Vérif manuelle : Pau Miquel 291.60 (ud 3.57), Gall 115.00 (kom 4.0). PASS.
