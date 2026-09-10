# 01 — Le multiplicateur Underdog boost tous les points au lieu des seuls points d'étape

Status: `done` (2026-08-28 — option B livrée : `underdog_mult` déplacé dans la parenthèse,
miroir verify + GAME_RULES §7/§14 + test underdog×classif ajoutés ; rescore différé au ticket 05)
Reported: 2026-08-27 (retour joueur, ligue classic V2, Vuelta 2026)
Blocks: `03-event-scoring-terms.md`, `05-rescore-vuelta-2026.md`

## Symptôme

Un coureur Underdog voit son `clamp(pcs_rank/100, 1, 4)` appliqué à **tout** son
total du jour : points d'étape **+ Daily Points (classif daily) + bonus échappée +
assists**. Les autres rôles (Climber, Sprinter, GC Leader, TT, Stage Hunter) ne
multiplient que les points d'étape.

Cas rapporté (Pau Miquel, `pcs_rank` 357) :
- 2e d'étape → `GT_STAGE_SCALE[1]` = 80
- 1 Daily Point de classement = 6
- observé : `(80 + 6) × 3.57 = 307.02`
- attendu : `80 × 3.57 + 6 = 291.6`

Le joueur avait calculé `80 × 3.57 = 286` et s'étonnait du 307. Écart = les 6 points
daily multipliés à tort.

## Cause

`services/pcs-sync/scoring.py:971-977` :

```python
xp = max(0, round(
    (raw_points * gt_role_mult * (1 + bonus)
     + gt_classif_bonus + gt_distance_bonus + assist_bonus)
    * nemesis_modifier * underdog_mult, 2))
```

`underdog_mult` est un facteur **hors parenthèse**, alors que `gt_role_mult` est
dedans. Pour un rôle `underdog`, `_role_multiplier()` (`scoring.py:371`) n'a pas de
branche dédiée et retombe sur `1.0`, donc le boost ne passe que par le facteur
externe.

`_underdog_multiplier()` (`scoring.py:410`) retourne déjà `1.0` sur les classements
**finaux** (`/gc`, `/points`, `/kom`) : le bug ne concerne donc que les classements
**daily** et les bonus additifs d'étape.

## Contradiction avec la spec

`docs/GAME_RULES.md` :
- §7 : `role_mult` est à l'intérieur de la parenthèse, appliqué à `rank_points`.
- §14 : « `underdog` est un rôle à part entière (…) le boost underdog **remplace** le
  `role_mult` habituel (…) c'est la valeur que prend `role_mult` quand le rôle est
  underdog (**pas un facteur séparé**) » et « appliqué à la base `rank_points` de
  l'étape ».

Le code fait donc l'inverse de la règle écrite. C'est un bug, pas un choix de design.

## Correctif attendu

Aligner le code sur §14 : que le boost Underdog soit la valeur de `role_mult`.

Deux options — **tranché le 2026-08-27 : option B retenue** (traçabilité préservée, aucune migration) :

- **(A) conforme à la lettre de la spec** : dans le bloc `_is_squad_race`
  (`scoring.py:840-847`), poser `gt_role_mult = _underdog_multiplier(...)` quand
  `role == "underdog"`, et retirer `underdog_mult` de la formule.
  Casse la traçabilité : la colonne `rider_xp_daily.underdog_mult` (migration
  `20260605000250`) n'aurait plus de valeur propre — il faudrait soit continuer à
  l'écrire en doublon, soit la retirer (migration + audit front).
- **(B) minimal, traçabilité préservée** : garder `underdog_mult` en colonne mais le
  déplacer **dans** la parenthèse :
  `raw_points * gt_role_mult * underdog_mult * (1 + bonus) + gt_classif_bonus + …`
  Recommandé : un seul déplacement, aucune migration, la colonne reste lisible.

L'exclusivité Underdog × Nemesis (`scoring.py:967`, GAME_RULES §13) reste inchangée
dans les deux cas.

## Fichiers à toucher

- `services/pcs-sync/scoring.py:971-977` (formule) et `840-847` si option A
- `services/pcs-sync/scripts/verify_tdf2026_closeout.py:277-353` — **miroir obligatoire**,
  ce script réimplémente la formule à l'identique pour la vérification
- `docs/GAME_RULES.md` §7/§14 — préciser noir sur blanc que le boost ne porte que sur
  `rank_points`, avec l'exemple ci-dessus
- Tests : `services/pcs-sync/tests/test_scoring_underdog_nemesis.py`,
  `test_underdog.py` — ajouter un cas underdog **avec** un `classif_bonus` non nul,
  qui est précisément le cas que la suite actuelle ne couvre pas (c'est ce trou qui a
  laissé passer le bug)

## Critère d'acceptation

Un underdog `pcs_rank=357`, 2e d'étape, avec 1 Daily Point de 6, marque **291.6** XP
et non 307.02.

## Ne pas faire dans ce ticket

Le rescore. Il est groupé en fin de lot — voir `05-rescore-vuelta-2026.md`.
