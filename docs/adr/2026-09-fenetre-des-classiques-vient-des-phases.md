# ADR 2026-09 — La fenêtre des Classiques vient des phases du jeu, pas du calendrier

Statut : accepté, 2026-09-15. Code : `apps/web/lib/race-groups.ts`
(`getRaceGroupWindow`), `apps/web/lib/phases.ts` (`CLASSICS_PHASE_IDS`).

## Contexte

Le palmarès classe la saison en quatre groupes : Classics, Giro, Tour, Vuelta.
Le statut d'un groupe (`played`, `ongoing`, `upcoming`, `not-played`) est calculé
dans `lib/palmares/current.ts` à partir d'une fenêtre de dates, et un groupe ne
devient `played` que si `today` dépasse la fin de sa fenêtre.

Ce statut n'est pas décoratif : `aggregate.ts` ne lit **que** les événements
`played` pour le face à face, les victoires et les maillots.

Jusqu'ici la fenêtre venait entièrement de `wt_calendar_2026.json` : min des
départs, max des arrivées, sur toutes les courses du groupe. Pour les Classiques,
le groupe est « toute course d'un jour du calendrier », lequel contient le GP
Québec (11/09), le GP Montréal (13/09) et Il Lombardia (10/10) — des courses que
le jeu ne joue pas. La fenêtre courait donc jusqu'au 10 octobre.

Deux définitions de « Classiques » coexistaient :

| Source | Périmètre | Fin |
|---|---|---|
| Jeu (`AUCTION_PHASES` 2 et 3) | Classics Part 1 + Part 2 | 1er mai |
| Palmarès (calendrier PCS) | toute course d'un jour de la saison | 10 octobre |

Constaté le 2026-09-15 : les Classiques 2026, finies depuis mai, étaient absentes
du face à face, des victoires et des maillots, pendant que l'onglet Seasons, qui
cumule l'XP de l'année **sans** regarder le statut, affichait une saison
d'apparence bouclée. Les deux écrans se contredisaient, et rien ne signalait
pourquoi.

## Décision

**La fin de la fenêtre du groupe `classics` est celle de la dernière phase
Classics du jeu.** Le calendrier reste la source du début (première course d'un
jour de la saison, ce qui garde `upcoming` juste en janvier) et la source
complète des trois Grands Tours, dont la fenêtre calendaire et la phase disent
déjà la même chose.

Le plafond ne peut que **raccourcir** la fenêtre : les phases ferment le groupe,
elles ne le rouvrent jamais au-delà d'une course que le calendrier a terminée.

`CLASSICS_PHASE_IDS` est exporté depuis `phases.ts` plutôt que déduit du libellé
des phases : un libellé est de l'affichage, il se renomme sans prévenir.

La fin est construite à la main depuis les entiers `endMonth`/`endDay`, et non
via `getPhaseRange`, qui renvoie des `Date` locales : la comparaison se fait sur
des chaînes `YYYY-MM-DD`, où un fuseau décale la borne d'un jour.

## Ce qui n'a pas été fait

**`getRaceGroupId` n'est pas touché.** Une classique d'automne reste rattachée au
groupe `classics`, ce qui garde le filtre du Ranking juste si l'une d'elles est
un jour scorée. La conséquence assumée : son XP s'ajouterait à un groupe déjà
déclaré `played`. Aucune n'est scorée aujourd'hui ; le jour où ça change, c'est
l'appartenance au groupe qu'il faut trancher, pas la fenêtre.

**Le calendrier n'est pas amputé.** `wt_calendar_2026.json` sert au pipeline de
scraping, pas seulement au palmarès : y retirer Lombardia pour arranger un écran
casserait la source.

## Conséquences

- Les Classiques passent `played` le 2 mai de chaque saison. Face à face,
  victoires et maillots les comptent.
- La saison 2026 affiche 4 groupes sur 4 joués, donc « champion » et non
  « leading · 3 of 4 phases », alors que la phase End of Season court jusqu'au
  18 octobre. C'est voulu : le palmarès raconte des épreuves, pas des phases
  d'enchères.
- Un décalage des phases Classiques dans `phases.ts` déplace mécaniquement la
  clôture du groupe. C'est le but, et c'est aussi le piège à connaître : le
  `TODO(playtest)` qui a déjà avancé le départ du Tour au 30/06 montre que ces
  dates bougent pour des raisons de playtest.

## Vérification

`apps/web/lib/race-groups.test.ts`, `describe("getRaceGroupWindow")` : les
Classiques 2026 ferment au 2026-05-01, les trois Grands Tours gardent leur
fenêtre calendaire, et les deux bornes se décalent bien sur une autre saison.
