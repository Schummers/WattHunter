# 03 — Corriger l'alignement rang ↔ coureur à l'import

Status: `done`
Created: 2026-09-14
Bloqué par: `01-tester-origine-decalage.md` (n'a de sens que si le verdict est H2)

## Problème

`stage.results()` retourne des entrées dont le `rider_url` ne correspond pas au
`rank` et aux `pcs_points` de la même entrée, sur certaines lignes. Notre boucle
d'import écrit fidèlement ce qu'on lui donne, donc écrit faux.

Deux signatures observées, détaillées dans le PRD : transposition de deux coureurs
voisins, et héritage du rang d'un coureur hors pool par un voisin.

## Solution attendue

Dépend du verdict du ticket 01 :

- **Si la lib désaligne ses colonnes** : reconstruire les entrées en lisant chaque
  ligne du tableau comme une unité, plutôt qu'en zippant des listes par colonne.
  Soit en corrigeant la lib en amont, soit en la contournant par un parse maison
  des lignes de résultats. Le contournement est probablement le bon choix : la lib
  est une dépendance externe, et on a déjà un besoin de parse maison ailleurs
  (`stage_events.py` lit déjà le HTML directement).
- **Si le HTML lui-même porte le décalage** : ce ticket est sans objet, fermer en
  `wontfix` et basculer sur l'arbitrage de source.

## Garde-fou à livrer avec le correctif

L'import doit **échouer bruyamment plutôt qu'écrire faux**. Le mode d'échec qui a
produit cet incident est le silence : rien dans les logs, `imported: 106,
skipped: 36`, et des données fausses en base.

Contrôles de cohérence possibles sur une ligne, à évaluer :
- les rangs stockés forment une suite strictement croissante sans doublon ;
- l'équipe lue sur la ligne correspond à `riders.real_team` du coureur résolu ;
- les `pcs_points` décroissent avec le rang.

Le troisième est le moins cher et attrape la famille B : dans les trois cas
observés, le coureur héritait de points inférieurs à ceux de son rang réel.

## Tests

Seam : `import_race_results()`, `fetch_html` patché sur la fixture HTML réelle
sauvegardée au ticket 01, vrai `Stage`. Prior art `tests/test_sync_race.py:65`.

Le test doit échouer sur la fixture actuelle avant le correctif. Un test qui passe
d'emblée ne prouve rien ici.

## Comments

## Livré — 2026-09-14

Verdict du ticket 01 : **H1**, mais le brouillage est déterministe et
réversible, donc ce ticket n'est pas `wontfix`. Correctif dans `sync_race`, la
lib `procyclingstats` n'est pas touchée.

### Ce qui a été écrit

`services/pcs-sync/pcs_deobfuscate.py` — deux signaux indépendants :

1. `data-id` non vide sur une `table.results` : le drapeau de PCS lui-même.
2. Incohérence intra-ligne : l'équipe imprimée dans la cellule Rider contre la
   colonne Team. C'est ce signal qui **localise** les lignes.

La réparation réintervertit les blocs `div.cont` entre les deux lignes de chaque
paire, l'inverse exact de ce que fait PCS. Le `data-id` est vidé après coup, donc
un second passage est un no-op propre.

**Garde-fou** : refus bruyant (`ObfuscationError`) dans deux cas, plutôt que
d'écrire faux.
- une table porte un `data-id` et on ne trouve rien à réparer (le schéma a
  changé) ;
- une ligne incohérente n'a pas de voisine croisée (permutation non reconnue,
  cycle plus long que 2). On ne devine pas.

Interrupteur : `PCS_DEOBFUSCATE=0` désactive réparation **et** garde-fou. Sortie
de secours seulement, la donnée qui passe alors n'est plus vérifiée.

### Branchement

- `sync.fetch_html` : point de passage unique de tous les scrapes, donc
  startlists, rankings, classements annexes, DNF et stage events sont couverts.
- `import_race_results` et `import_gc_results` : seam explicite prescrit par le
  ticket, testable, idempotent en production. Les réparations remontent dans
  `result["deobfuscated"]` et s'impriment dans `run_pipeline`.

### Vérification

`services/pcs-sync/tests/test_pcs_deobfuscate.py`, 10 tests sur du **HTML PCS
réel** gzippé (`tests/fixtures/`), pas des squelettes.

- `test_scrambled_page_is_wrong_before_repair` échoue si la fixture cesse d'être
  brouillée. Sans lui, les autres tests pourraient passer en ne prouvant rien.
- Les lignes que notre détecteur trouve sont **exactement** celles que le CSS de
  PCS nomme : 6/7, 15/16, 29/30 sur la table d'étape, 9 paires sur 5 tables. Deux
  signaux indépendants qui concordent au numéro de ligne près.
- Étape 4 (propre, même forme de page, coureur hors pool au rang 14, groupes au
  même temps) : 0 faux positif, octets inchangés.
- Bout en bout par `import_race_results` : les lignes écrites en base sont celles
  de la capture.

Suite complète : **380 passed, 11 skipped**, aucune régression.

Contre-épreuve en direct sur le site, chemin de production, lecture seule :
9 réparations loguées, **0 écart vs capture sur les 24 rangs vérifiés**.

### Ce qui reste incertain

Seules des paires **adjacentes** ont été observées, jamais un cycle de 3. Si PCS
change de schéma, le garde-fou refuse l'import au lieu de se tromper : c'est le
comportement voulu, mais ça arrêtera le pipeline. Le ticket 02 (harnais contre
source externe) reste la vérification de dernier recours.
