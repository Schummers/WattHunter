# Playbook — Clôturer un Grand Tour sans importer de rangs faux

Écrit le 2026-09-14 après la clôture de la Vuelta 2026. Décisions associées :
`docs/adr/2026-09-verification-import-par-source-independante.md`.
Runbook d'exécution : `docs/runbooks/vuelta2026-closeout-2026-09-14.md`.
Tickets : `.scratch/pcs-import-integrity/issues/01` à `08`.

Cette note rassemble ce qui a été découvert, ce qui a été corrigé, comment le
scoring d'un Grand Tour fonctionne réellement, et les pièges qui ont chacun
coûté une écriture en prod ou un audit faux. Elle est écrite pour la personne
qui clôturera le prochain Grand Tour sans avoir vécu celui-ci.

---

## 1. Les bugs trouvés

### 1.1 PCS brouille l'ordre DOM des noms de coureurs (cause racine)

procyclingstats.com mélange délibérément, dans certaines tables de résultats,
la cellule `ridername` de lignes voisines, puis remet l'ordre visuel en place
en CSS (`position:absolute; top:-19px` sur `div.cont`, ciblé par
`.results[data-id="…"] tbody tr:nth-child(n)`). Sur une ligne brouillée, le
nom est celui du voisin ; le rang, le BIB, l'âge, les points et l'équipe sont
ceux de la vraie ligne. **L'écran dit vrai, le markup ment.** Un navigateur
normal reçoit le même DOM : ce n'est pas ciblé sur les bots.

Le brouillage **tourne dans le temps** : une étape brouillée en août peut être
propre en septembre, et l'inverse. Conséquence : un ré-import « pour voir »
répare une étape et en casse une autre. Ni notre code ni la lib
`procyclingstats` n'étaient en cause ; ils lisaient fidèlement un DOM faux.

Étendue mesurée : Vuelta 2026, 54 rangs faux sur 16 étapes sur 20, 11 sur les
slugs de clôture, `youth` final réduit à 1 ligne. Tour 2026 : 79 rangs faux
sur 454 dans la zone qui score. Giro 2026 : non mesuré.

### 1.2 Deux Grands Tours clos avec des audits « 0 écart » qui ne vérifiaient rien

`verify_tdf2026_closeout.py` et les audits Tour/Vuelta recalculaient l'XP
**depuis le rang stocké** et le comparaient à l'XP stocké. Ils prouvaient que
le barème était bien appliqué à des rangs faux. Aucun ne confrontait le rang à
une source. C'est la leçon la plus importante de cet incident : **un rescore
ne prouve rien sur l'import.**

### 1.3 Pendant la réparation : une seule `race_date` pour 20 étapes

Le premier script de clôture a passé la date de fin de course
(`2026-09-13`) à `import_race_results` pour chaque étape. Or le moteur de
scoring calcule le cutoff des rôles (11:00 le jour de l'étape) à partir de
`race_results.race_date`. Les 20 étapes ont donc été scorées avec les rôles du
13 septembre. Les joueurs changent de rôle presque chaque jour, l'effet était
massif : −561 XP sur une équipe, +102 sur une autre, 87 lignes touchées, et
un classement de Vuelta faux avec des rangs justes.

### 1.4 Le moteur ne calcule qu'un cutoff par appel

`calculate_daily_scores(race_slugs=[...])` dérive **un seul** cutoff de rôles
et de squad, depuis le premier slug (« all slugs in one call share a date »).
Passer 20 étapes en un appel fige les rôles d'un jour sur tout le Grand Tour.
La prod ne rencontre jamais ce cas (une étape par jour) ; un rescore
rétroactif le rencontre toujours.

---

## 2. Ce qui a été corrigé

### 2.1 `services/pcs-sync/pcs_deobfuscate.py` (PR #74)

Branché dans `fetch_html`, c'est-à-dire sur le chemin de **tous** les scrapes.
Il détecte les lignes brouillées (incohérence entre la cellule nom et le reste
de la ligne), les répare quand la permutation est une paire adjacente, et
**refuse la page** dans les autres cas. Le refus est le garde-fou :
`PCS_DEOBFUSCATE=0` désactive réparation et refus, ne jamais s'en servir pour
« débloquer » un import.

Validation du correctif : les lignes détectées correspondent exactement à
celles que le CSS de PCS nomme (9 paires sur 5 tables), puis **0 écart sur 200
rangs contre Wikipedia**, source sans aucun lien avec PCS.

Réparation idempotente : une page déjà réparée repasse sans changement
(vérifié par hash du parse sur quatre étapes brouillées). Ça permet de
ré-importer depuis des pages mises en cache après `fetch_html`.

### 2.2 Le contrôle par source indépendante (nouveau, obligatoire)

`.scratch/pcs-import-integrity/verif/wikipedia_crosscheck.py`. Wikipedia
publie le top 10 de chaque étape dans un wikitext parfaitement régulier
(`{{cyclingresult|rang|[[Nom]]|…}}`), accessible par l'API
(`action=parse&prop=wikitext`), donc parsable de façon déterministe et
rejouable. Le harnais confronte trois sources : Wikipedia, PCS refetché par le
chemin de prod, la base. Deux résultats : « PCS réparé vs Wikipedia » valide
le correctif ; « base vs Wikipedia » mesure le dégât.

Trois pièges de ce harnais, déjà payés :
- un lien pipe `[[Matthew Brennan (cyclist)|Matthew Brennan]]` casse une
  regex naïve qui s'arrête au premier `|` ;
- les deux sources n'épellent pas pareil (Alexey/Aleksey Lutsenko, Eddie
  Dunbar / `edward-irl-dunbar`, Ivo Oliveira / `ivo-emanuel-alves`) : table
  d'alias explicite, vérifiée à la main, jamais de comparaison floue ;
- Wikipedia se trompe aussi (étape 1 : deux coéquipiers à 1" inversés).
  Quand PCS et Wikipedia divergent sur une page **non brouillée**
  (`data-id=""`, aucune règle CSS `div.cont`), c'est Wikipedia qui a tort ;
  l'utilisateur tranche, la ligne va dans `WIKIPEDIA_KNOWN_ERRORS`.

Limite : Wikipedia s'arrête au rang 10. Les rangs 11-20 ne sont validés que
par le correctif lui-même.

### 2.3 La preuve en trois couches

| Couche | Question | Outil | Vert quand |
|---|---|---|---|
| 1. Intégrité de l'import | les rangs en base sont-ils les vrais ? | `wikipedia_crosscheck.py` | 0 écart hors erreurs Wikipedia validées |
| 2. Conformité du barème | l'XP suit-il GAME_RULES §7 pour ce rang ? | `preuve_cloture.py` | 0 écart |
| 3. Dérive | des lignes ont-elles bougé sans changement de rang ? | `diff_cloture.py`, colonne `derive` | 0 ligne, ou chacune expliquée par un commit |

La couche 3 est celle qui a attrapé le bug 1.3. Les totaux par équipe ne
suffisent pas : un classement peut être faux avec des totaux plausibles.

---

## 3. Lire une ligne d'XP

La formule, les tables de rang et les multiplicateurs sont dans
`docs/GAME_RULES.md` §7, seule source. Trois choses à savoir pour lire une
ligne de `rider_xp_daily` pendant une clôture, et qu'on ne devine pas :

- le **cutoff des rôles** est 11:00 Europe/Paris le jour de l'étape, dérivé
  de `race_results.race_date` ; rôles depuis `gt_role_assignments` (dernière
  assignation `applied_at <= cutoff`), squad depuis `gt_squad` (fenêtre
  `[created_at, removed_at)`). Une squad validée après 11:00 score 0 ce
  jour-là : c'est arrivé à deux équipes à l'étape 1 de la Vuelta, ce n'est
  pas un bug d'import ;
- l'**underdog** lit `riders.pcs_rank` **actuel** : seule composante que le
  moteur ne peut pas rejouer à l'identique si le classement PCS a bougé ;
- les **maillots finaux** (points/kom/youth) vivent dans
  `gt_final_classifications` avec `raw_pcs_points = 0` par convention, le
  barème est directement dans `xp_gained`. Une vérification qui lit
  `raw_pcs_points` sur ces slugs verra 19 faux écarts.

## 4. Procédure de clôture d'un Grand Tour (ordre obligatoire)

1. **Contrôle par source indépendante, avant toute écriture.** Pages
   Wikipedia dans `fixtures/wikipedia/`, refetch des étapes par le chemin de
   prod dans `fixtures/sweep-<course>/` (ces pages sont la seule trace de ce
   qui a été mesuré, ne pas les effacer), `wikipedia_crosscheck.py`. Si
   « PCS réparé vs Wikipedia » n'est pas à 0 hors erreurs Wikipedia
   validées, le correctif a un trou : s'arrêter.
2. **Baseline** : snapshot de `teams`, `rider_xp_daily`, `race_results`,
   `gt_final_classifications` sur les slugs de la course. Sans baseline, pas
   de diff, donc pas de preuve.
3. **Ré-import depuis le cache**, `fetch_html` patché pour refuser tout
   scrape en direct. **Une `race_date` par étape, depuis `stage_profiles`.**
4. **Rescore, une étape par appel.** Seuls les cinq slugs de clôture
   (`stage-21`, `gc`, `points`, `kom`, `youth`) partagent un appel, ils ont
   la même date. Un rescore limité à `points`/`kom`/`youth` ne fait rien :
   la boucle est pilotée par `race_results`, il faut `stage-21` et `gc`.
5. **Diff décomposé** (`diff_cloture.py`) sur **toutes** les équipes, pas
   seulement celles visées : rang / classif / maillots / dérive. Une ligne en
   dérive non expliquée par un commit daté = le rescore n'a pas reproduit ce
   qui a été joué, quels que soient les totaux.
6. **Preuve** (`preuve_cloture.py`) : tableau par équipe, par étape, par
   coureur, avec rang, barème, multiplicateurs, XP. Publiable tel quel.
7. **Runbook** daté dans `docs/runbooks/`, incluant ce qui a mal tourné.

---

## 5. Ce qu'on ne fait plus

- **Rescorer une course close depuis longtemps avec le code actuel.** Quatre
  changements de barème entre juillet et septembre 2026 : un rescore du Tour
  mélangerait la correction d'un bug et un barème que les joueurs n'ont pas
  joué. Pour le Tour 2026 : rangs corrigés, XP intacte, marge documentée
  (+29 XP max par équipe, 171 XP d'écart minimum entre deux places). Pour le
  Giro : diagnostic d'abord, décision ensuite.
- **Croire un audit qui ne sort pas de la base.** Toute vérification d'import
  confronte à une source externe, ou n'est pas une vérification.
- **Scraper pendant une clôture.** On importe ce qu'on a mesuré, pas ce que
  PCS affiche cinq minutes plus tard.
- **Passer plusieurs étapes à `calculate_daily_scores`.**
- **Passer la date de fin de course à un import d'étape.**

---

## 6. Ce qu'il reste à durcir

- Sortir `wikipedia_crosscheck.py`, `cloture_vuelta.py`, `diff_cloture.py`,
  `preuve_cloture.py` de `.scratch/` vers `services/pcs-sync/scripts/`,
  paramétrés par slug de course et titres de pages Wikipedia. On les relance
  à chaque Grand Tour.
- Faire de `calculate_daily_scores` un appel qui refuse plusieurs dates
  d'étape, au lieu d'en prendre une en silence.
- `import_final_classifications` n'appelle pas `deobfuscate` explicitement
  comme le font `import_race_results` et `import_gc_results`. Couvert par
  `fetch_html`, mais l'asymétrie est un piège au prochain refactor.
- Avant chaque clôture, refetcher en direct une étape connue brouillée pour
  vérifier que le détecteur reconnaît encore la forme du jour. PCS peut
  changer de technique sans prévenir.
- Versionner `riders.pcs_rank` par phase, pour que l'underdog soit rejouable.
