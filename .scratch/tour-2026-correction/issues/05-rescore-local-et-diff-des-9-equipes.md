# 05 — Rescore local scopé Tour, diff des 9 équipes

**What to build:** le chiffre réel. Le Tour rescoré au code d'aujourd'hui sur
une base locale où les rangs sont justes et les événements présents, avec un
diff qui rend chaque XP déplacé explicable. Ce ticket se termine par une
lecture humaine, pas par une écriture.

**Blocked by:** 03, 04 faits. **Bloque desormais sur une decision : le rescore du Tour n'est pas executable avec le code de scoring actuel.**

**Status:** needs-info — decision utilisateur requise

- [x] Baseline pris après 03 et 04, avant le rescore
- [x] Rescore via `calculate_daily_scores` scopé aux 24 slugs du périmètre (étapes 2-21 + gc + points/kom/youth), étape par étape puis finaux, jamais de rescore large — exécuté, **résultat inexploitable**
- [x] `stage-1` : lignes `rider_xp_daily` identiques au baseline. Si le moteur les touche, le ticket le dit et ne conclut pas avant de comprendre — non touchée, mais 17 lignes d'autres slugs détruites
- [ ] Diff par équipe sur les 9 équipes : `cumulative_xp`, `level`, total `rider_xp_daily` par slug, lignes `team_ranking_daily` réécrites. Aucune équipe hors ligue V2 touchée
- [ ] Le diff est confronté à la projection D du diagnostic : part « finaux » égale au drift mesuré à ±1 XP, part « rangs » égale au delta bug à ±1 XP, part « événements » dans la fourchette 602-1204. Tout résidu au-delà est expliqué ligne à ligne ou le ticket échoue
- [ ] Classement du Tour et classement cumulé, avant / après, en deux tableaux lisibles ; les places qui changent sont nommées avec leur cause (barème, événements, rangs)
- [ ] Aucun `level` ne régresse (grandfather) ; tout level-up est listé
- [ ] `team_ranking_daily` : les dates de juillet réécrites sont listées ; le ticket dit explicitement que l'historique de classement change
- [x] Rapport court écrit dans ce ticket. Statut `needs-info` et non `ready-for-human` : il n'y a pas de rapport à valider, il y a une décision à prendre. **Aucune écriture prod, conformément à la consigne.**


## Resultat : le rescore ne peut pas reproduire juillet

Le rescore a ete lance en local sur les 24 slugs, une etape par appel, sur la
base issue des tickets 03 et 04. **Il ne produit rien d'exploitable.**

| Mesure | Valeur |
|---|---|
| Lignes `rider_xp_daily` reecrites | **17** sur 1539 |
| dont `raw_pcs_points` mis a **0** | **17 sur 17** |
| Lignes portant un bonus d'evenement apres rescore | **0** |
| Lignes gardant leurs valeurs de juillet, non recalculees | **1522** |
| Equipes touchees | 3 (Klimax 9 lignes, Leopard_Trek 6, Peejee 2) |

`cumulative_xp` : Leopard_Trek -2029,00, Klimax -1847,88, Peejee -1104,20, les
six autres inchangees. Ce ne sont pas des deltas de bareme, c'est de la
destruction.

Les 763 XP d'evenements importes au ticket 04 ont ete distribues a **zero**
coureur. La rehausse des baremes finaux n'a ete appliquee a rien : `points`,
`kom` et `youth` sont sortis en `processed=0`.

## La cause : le scoring lit les contrats d'aujourd'hui

`calculate_daily_scores` construit son ensemble de coureurs a partir des
contrats de statut `active` ou `notice`, puis rejette chaque resultat dont la
`race_date` tombe hors de la fenetre `purchased_at` -> `released_at`.

Dans la ligue V2, aujourd'hui :

| | |
|---|---|
| Contrats `active` | **70** |
| dont achetes **apres la fin du Tour** (2026-07-26) | **70 sur 70** |
| Contrats `released` | 82 |

Les 82 contrats qui tenaient pendant le Tour ont ete liberes au reset de phase
de la Vuelta, le 2026-08-19 (77 liberations, memoire `vuelta2026_phase_setup`).
Ils ne sont **jamais charges** : le filtre de statut les exclut. Et les 70
contrats actifs ont tous ete achetes en aout, donc la fenetre rejette toutes les
etapes de juillet.

**Aucun coureur n'est eligible sur aucun slug du Tour.** Le cas type est Mads
Pedersen : contrat Klimax du 2026-07-04, libere le 2026-08-19, **rachete par
Klimax le 2026-08-21**. Il entre donc dans la boucle par son contrat d'aout, la
fenetre rejette son resultat du 7 juillet, et la seconde passe « classement
seul » lui reecrit une ligne a `raw_pcs_points = 0`, `gt_role_mult = 1.0` :
162 XP deviennent 12.

Les six equipes « inchangees » ne le sont pas par justesse. Leurs coureurs de
juillet n'ont simplement pas ete rachetes, donc aucune ligne n'a ete recalculee
et les valeurs de juillet ont survecu par accident. **L'etat obtenu est un
melange de juillet et de recalculs d'aout**, ce qui est pire qu'un resultat
faux et homogene.

## Pourquoi la Vuelta a marche et pas le Tour

La Vuelta a ete rescoree **pendant sa propre phase**, contrats encore actifs.
Le Tour est rescore deux phases plus tard. Le rescore d'un Grand Tour n'a
jamais ete un geste re-jouable a froid : il ne l'etait qu'a chaud, et personne
ne l'avait ecrit.

Le diagnostic (ticket 09) chiffrait le drift d'un rescore par reconstruction
analytique, a partir des colonnes deja stockees dans `rider_xp_daily`. C'etait
juste comme arithmetique, et ca ne disait rien sur la faisabilite : il n'a
jamais fait tourner le moteur.

## Ce qui n'a PAS ete touche

- **La prod n'a recu aucune ecriture**, a aucun moment de ce ticket.
- La base locale a ete **restauree a l'identique** dans son etat d'apres
  ticket 04 (`restaure_local_depuis_snapshot.py`, diff a 0,00 sur les 9 equipes
  et aucun slug). Les rangs corriges du 03 et les evenements du 04 sont intacts.
- Le ticket 06 ne doit rien rejouer en l'etat.

## Trois issues, la decision n'appartient pas a l'agent

1. **Rendre le scoring datable.** Charger les contrats dont la fenetre couvre la
   date de l'etape, quel que soit leur statut actuel, au lieu des seuls contrats
   actifs. C'est la seule voie qui rende l'option C executable, et accessoirement
   la seule qui rende **tout** rescore retroactif possible a l'avenir. Mais
   c'est une modification du moteur de scoring de production, a tester
   serieusement, et elle sort du perimetre d'un chantier de correction de rangs.
2. **Se rabattre sur l'option A** du diagnostic : garder les rangs corriges des
   tickets 03 et 04, ne pas rescorer. Le classement cumule ne bouge pas,
   `cumulative_xp` reste celui de juillet, et la base devient coherente sur les
   rangs. Les 763 XP d'evenements ne sont pas distribues, ce qui laisse le Tour
   et la Vuelta sur deux regles differentes — l'ecart que le diagnostic
   signalait deja.
3. **Renoncer aussi aux evenements** et ne pousser que les rangs, ce qui revient
   a l'option A sans le ticket 04.

Le diagnostic recommandait deja d'exclure l'option C, pour une raison
differente : elle renverse le podium cumule (Peejee 2e -> 4e) a cause des
baremes d'aout, pas du bug. Cette raison-la tenait de l'arbitrage produit. Celle
de ce ticket est technique et ne s'arbitre pas : en l'etat, C ne s'execute pas.
