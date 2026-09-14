# Handoff — Après la Vuelta : Tour de France 2026, puis Giro 2026

Rédigé le 2026-09-14. **Vuelta 2026 clôturée et prouvée** (0/200 vs Wikipedia,
0 écart de barème, 0 dérive) : `docs/runbooks/vuelta2026-closeout-2026-09-14.md`,
dont l'incident `race_date` à lire avant de réutiliser `cloture_vuelta.py`. Repo `~/AI OS/cycling/watthunter`.

## Le contexte en trois lignes

PCS brouille l'ordre DOM des noms de coureurs sur ses tables de résultats et le
rétablit en CSS. Tout ce qui a été importé avant le correctif `pcs_deobfuscate.py`
(PR #74, 2026-09-14) a pu lire des rangs faux. La Vuelta est corrigée. Le Tour
(clos le 2026-07-27) et le Giro (clos le 2026-06-03) ont été importés avec le
même scraper, sur la même ligue Classic V2, et n'ont jamais été vérifiés contre
une source indépendante.

## Ce que la Vuelta a appris, à réutiliser tel quel

1. **Wikipedia est la source indépendante qui manquait.** Le wikitext brut, tiré
   par l'API (`action=parse&prop=wikitext`), donne le top 10 de chaque étape
   dans un format parfaitement régulier (`{{cyclingresult|rang|[[Nom]]|...}}`).
   Aucun lien avec PCS, parsing déterministe, rejouable. Le top 10 est aussi la
   zone qui pèse le plus en XP.
2. **Trois outils, tous dans `.scratch/pcs-import-integrity/verif/`**, à
   paramétrer par course au lieu de les recopier :
   - `wikipedia_crosscheck.py` — triangulation Wikipedia / PCS réparé / base.
   - `cloture_vuelta.py` — baseline, ré-import depuis le cache, rescore scopé,
     diff sur toutes les équipes. Refuse de scraper en direct.
   - `preuve_cloture.py` — deux couches : intégrité de l'import (rangs vs
     Wikipedia) et conformité du barème (XP vs GAME_RULES §7).
3. **Deux pièges qui ont failli coûter la vérification :**
   - un lien pipe `[[Nom (cyclist)|Nom]]` casse une regex naïve ;
   - les deux sources n'épellent pas pareil (Alexey/Aleksey Lutsenko, Eddie
     Dunbar / `edward-irl-dunbar`, Ivo Oliveira / `ivo-emanuel-alves`). Une
     table d'alias documentée, vérifiée à la main, pas une comparaison floue.
4. **Un rescore ne prouve rien sur l'import.** `verify_tdf2026_closeout.py`
   disait « 0 écart » et le Tour est peut-être faux : il testait le barème
   appliqué au rang stocké, jamais le rang lui-même.

## Décision de l'utilisateur (2026-09-14) : diagnostic seul, pas de réécriture

**Périmètre arrêté** : pour le Tour puis le Giro, on mesure l'ampleur du dégât,
on ne réécrit rien. Les barèmes de l'époque ne sont plus ceux du code, un rescore
mélangerait la correction du bug et le drift. Rien ne doit toucher la prod tant
que le diagnostic n'est pas posé et lu.

## Tour de France 2026 — diagnostic

### Ce qu'on veut savoir

1. Combien de rangs faux dans le **top 15** de chacune des étapes, contre une
   source indépendante (Wikipedia donne le top 10, PCS réparé prolonge à 15).
2. Combien de ces rangs touchent un coureur sous contrat en Classic V2, et
   dans quelle équipe.
3. L'exposition XP par équipe, **au barème de juillet** (celui qui a été joué),
   pas au barème actuel. Barème d'étape inchangé depuis (top 20 : 100, 80, 70,
   65, 55, 50, 45, 35, 30, 25, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2), donc les
   écarts d'étape se chiffrent directement. Les finaux (GC / points / KOM /
   youth) ont changé : les chiffrer au barème de juillet
   (`git show 92dbf19~1:docs/GAME_RULES.md`, section §7 avant `3583af0`).
4. L'écart entre places au classement Tour, pour dire si une place est en jeu.

### Le drift, à chiffrer à part

Quatre changements de scoring depuis la clôture du Tour, tous en prod :

| Commit | Changement | Effet d'un rescore du Tour |
|---|---|---|
| `0a0b106` | underdog appliqué aux rank_points seuls | baisse l'XP de certains underdogs |
| `3583af0` | finaux GC 450 / Points-KOM 150 / Youth 75 | monte l'XP des maillots |
| `844cae8` | termes additifs cotes et sprints (`stage_event_results`) | ajoute de l'XP, si les événements sont importés |
| `92dbf19` | GC final 450 → 400, courbe ×0.89 | rebaisse le GC |

Le diagnostic doit produire **deux colonnes séparées** par équipe : ce que le
bug d'import a coûté ou donné, et ce qu'un rescore au code actuel changerait
en plus. La seconde colonne sert à expliquer pourquoi on ne rescore pas.

### Séquence, lecture seule

1. Pages Wikipedia du Tour 2026 (`2026 Tour de France, Stage 1 to Stage 11`,
   `Stage 12 to Stage 21`, article principal) → `fixtures/wikipedia/`.
2. Refetch les 21 étapes + gc/points/kom/youth par le chemin de prod, correctif
   actif, pages sauvées dans `fixtures/sweep-tdf/`. `SCRAPER_BACKEND=playwright`.
   Le brouillage tourne dans le temps : ce qu'on refetch est l'état du jour,
   réparé, et c'est la référence PCS qu'on compare.
3. `wikipedia_crosscheck.py` paramétré Tour, étendu au top 15 (Wikipedia
   valide 1-10, PCS réparé seul pour 11-15). Sortie : PCS réparé vs Wikipedia
   (doit être ~0), base vs Wikipedia, base vs PCS réparé sur 1-15.
4. Croiser avec les contrats Classic V2 au moment de chaque étape (attention au
   `role_cutoff` et aux squads GT, pas seulement à `contracts`).
5. Exposition XP par équipe au barème de juillet + écart entre places.
6. Livrable : un ticket `.scratch/pcs-import-integrity/issues/09-diagnostic-tour-2026.md`
   sur le modèle du ticket 08 (tableau des écarts, classement, exposition,
   points à contre-vérifier). **Aucune écriture.**

Piège Tour : l'étape 1 était un TTT scoré via GC (mémoire
`tdf2026_stage1_ttt_via_gc`). Wikipedia donne un classement d'équipes ce
jour-là, pas de top 10 individuel : exclure l'étape 1 du crosscheck et la
traiter à part.

## Giro 2026 — diagnostic, ensuite, priorité basse

Même séquence, même livrable (ticket 10). Clos le 2026-06-03 avec un cutover
ancien/nouveau barème et une injection manuelle depuis captures (postmortem
`docs/runbooks/giro-cutover-postmortem-2026-06-03.md`). Le drift y est plus
large encore : les deux colonnes séparées sont indispensables. Pages Wikipedia :
`2026 Giro d'Italia, Stage 1 to Stage 11` et `Stage 12 to Stage 21`.

## Après les deux diagnostics

Décision avec l'utilisateur, course par course, sur la base des tickets 09 et
10. Rien n'est réécrit avant.

## Ce qu'il faut durcir avant le prochain Grand Tour (Giro 2027)

- Sortir les trois outils de `.scratch/` vers `services/pcs-sync/scripts/`,
  paramétrés par slug de course et titres de pages Wikipedia. Un `.scratch/`
  n'est pas un endroit pour de l'outillage qu'on relance chaque saison.
- Ajouter le crosscheck Wikipedia au runbook de clôture standard, **avant** le
  rescore. Un « 0 écart » de barème ne suffit plus comme preuve.
- `import_final_classifications` ne fait pas l'appel explicite à `deobfuscate`
  que font `import_race_results` et `import_gc_results`. Il est couvert par
  `fetch_html`, mais l'asymétrie est un piège pour le prochain qui refactore.
- Refetch en direct au moins une étape connue brouillée avant chaque clôture,
  pour vérifier que le détecteur reconnaît encore la forme du jour. PCS peut
  changer sa technique de brouillage sans prévenir.

## Réserves ouvertes

- Vuelta étape 1, rangs 6-7 (Chamberlain / Bisiaux) : Wikipedia et PCS
  divergent, page non brouillée, PCS probablement juste. 5 XP Peejee. Voir le
  runbook Vuelta.
- Le crosscheck ne couvre que le top 10. Les rangs 11-20 (14 écarts sur la
  Vuelta, barème 20 → 2 pts) ne sont validés que par le correctif lui-même et
  par sa correspondance avec le CSS de PCS.
