# 03 — Ré-import des rangs en local, XP intact

**What to build:** en local, les résultats du Tour deviennent vrais (rangs
d'étape, GC finale, maillots) sans qu'aucun XP ne bouge, ce qui isole la
correction des rangs de tout effet de barème.

**Blocked by:** 01, 02.

**Status:** ready-for-human

- [x] Baseline pris avec l'outil du 02 avant toute écriture
- [x] Ré-import des 20 étapes (2 à 21) + `gc` dans `race_results` et de `points` / `kom` / `youth` dans `gt_final_classifications`, depuis le cache, correctif `pcs_deobfuscate` actif
- [x] Crosscheck Wikipedia en local : **0 / 198**, strict, sans liste d'erreurs Wikipedia connues (il n'y en a aucune sur le Tour) — obtenu **0 / 200**, voir « Les dénominateurs ont grossi »
- [x] Balayage de la zone scorée en local : **0 / 454** — obtenu **0 / 459**, même raison
- [x] `stage-1` : ses 18 lignes de `race_results` sont identiques au baseline, ligne à ligne
- [x] `rider_xp_daily`, `teams` et `team_ranking_daily` strictement identiques au baseline (0 ligne de diff) : le rescore n'a pas tourné
- [x] Nombre de lignes par slug avant / après consigné dans le ticket ; un slug qui perd des lignes est expliqué (coureur hors pool) ou le ticket échoue

## Résultat

Snapshots : `20260914-171808-avant-reimport.json` → `20260914-171830-apres-reimport.json`.

| Vérification | Attendu | Mesuré |
|---|---|---|
| PCS réparé vs Wikipedia | 0 | **0 / 200** |
| Base vs Wikipedia | 0 / 198 | **0 / 200** |
| Base vs PCS réparé, rangs 1-15 | — | **0 / 300** |
| Zone scorée | 0 / 454 | **0 / 459** |
| `stage-1`, 18 lignes | identiques | **identiques, ligne à ligne** |
| `rider_xp_daily` | 0 diff | **1539 lignes identiques** |
| `teams` | 0 diff | **9 lignes identiques** |
| `team_ranking_daily` | 0 diff | **261 lignes identiques** |

Les 79 rangs faux sont corrigés et aucun XP n'a bougé. Rejouable :
`.scratch/tour-2026-correction/verif_reimport.py <avant> <apres>`, qui sort en
code 1 si une seule des trois familles d'invariants casse.

`deob=0` sur les 25 pages : le cache avait déjà été réparé au moment du fetch,
le correctif rejoué est un no-op. C'est la confirmation qu'il est idempotent,
pas le signe qu'il ne tourne pas.

## Les dénominateurs ont grossi, et c'est la même cause que les +6/+7 lignes

Le ticket attendait 0 / 198 et 0 / 454 ; les vérifications rendent 0 / 200 et
0 / 459. **Le nombre d'écarts est bien zéro, c'est la base de comparaison qui
s'est élargie** : le ré-import a ajouté des lignes qui manquaient.

| Slug | `race_results` avant → après | | Slug | avant → après |
|---|---|---|---|---|
| stage-1 | 18 → 18 (+0) | | stage-12 | 154 → 161 (+7) |
| stage-2 | 162 → 169 (+7) | | stage-13 | 154 → 161 (+7) |
| stage-3 | 161 → 168 (+7) | | stage-14 | 151 → 158 (+7) |
| stage-4 | 160 → 167 (+7) | | stage-15 | 149 → 156 (+7) |
| stage-5 | 160 → 167 (+7) | | stage-16 | 146 → 153 (+7) |
| stage-6 | 160 → 167 (+7) | | stage-17 | 145 → 151 (+6) |
| stage-7 | 157 → 164 (+7) | | stage-18 | 145 → 151 (+6) |
| stage-8 | 156 → 163 (+7) | | stage-19 | 143 → 149 (+6) |
| stage-9 | 156 → 163 (+7) | | stage-20 | 141 → 147 (+6) |
| stage-10 | 156 → 163 (+7) | | stage-21 | 139 → 145 (+6) |
| stage-11 | 155 → 162 (+7) | | gc | 139 → 145 (+6) |

`gt_final_classifications` : points 112 → 114, kom 56 → 58, youth 32 → 34.

**Aucun slug ne perd de ligne.** Le total passe de 3207 à 3348, soit 147 lignes,
portées par **7 coureurs** : Sean Quinn (rang PCS 312), Lars Craps (469), John
Degenkolb (549), Anders Skaarseth (552), Michel Hessmann (572), Jan Tratnik
(576), Robbe Dhondt (517).

Mécanique : `import_race_results` mappe `rider_url → rider_id` sur la table
`riders` **d'aujourd'hui**. Ces sept-là sont entrés dans le pool après juillet
2026 ; à l'import d'origine ils tombaient dans `skipped`, ils sont désormais
mappables.

**Aucun des sept n'est sous contrat dans une équipe de la ligue V2**, vérifié
contrat par contrat (`verif_lignes_ajoutees.py`). Le rescore du ticket 05 ne
leur distribuera donc rien, et le delta par équipe reste imputable au seul bug
d'import. Si l'un d'eux avait eu un contrat, il aurait fallu trancher avant de
rescorer : le ré-import aurait créé de l'XP qui n'a jamais existé.

## Effet de bord assumé : les événements arrivent avec le ré-import

`stage_event_results` passe de 0 à 503 lignes pendant ce ticket, sans qu'il le
demande. Ce n'est pas une dérive : `import_race_results` importe les côtes et
les sprints de la même page, sur toute étape de Grand Tour, et c'est le chemin
de production. Le ticket 04 les rejoue ensuite seuls (idempotent) et couvre en
plus l'étape 1, que le ré-import laisse de côté.

## Artefacts

`verif/apres-reimport-crosscheck.json` et `verif/apres-reimport-etendue.json`
gardent l'état d'après correction. Les deux JSON de `pcs-import-integrity/` ont
été **restaurés** à leur version d'origine : ils documentent l'état de la prod
avant correction, ce sont les pièces du diagnostic.
