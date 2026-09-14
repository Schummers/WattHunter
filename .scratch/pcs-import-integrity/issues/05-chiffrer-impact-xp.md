# 05 — Chiffrer l'impact XP des erreurs de rang, puis décider du rattrapage

Status: `superseded`
Created: 2026-09-14

## Problème

Les étapes 1 à 20 de la Vuelta 2026 sont déjà scorées avec des rangs dont on sait
maintenant qu'environ 9% sont faux. On ne peut pas décider quoi en faire sans
savoir ce que ça change réellement pour les équipes.

## Travail

1. **Chiffrer les 13 erreurs connues** (étapes 4, 7, 13, 16, 19 — voir le tableau
   du PRD) : pour chaque rang faux, l'XP effectivement crédité contre l'XP dû,
   par coureur puis agrégé par équipe de la ligue Classic V2.
2. **Déterminer si un classement d'équipe bouge.** C'est le seul critère qui compte
   vraiment : une erreur qui ne déplace personne ne justifie pas un rescore.
3. **Estimer l'étendue non mesurée** : 13 étapes sur 21 n'ont jamais été confrontées
   à une source externe. Extrapoler l'ordre de grandeur à partir du taux observé,
   en disant clairement qu'il s'agit d'une extrapolation.

Lecture seule. Aucun rescore dans ce ticket.

## Options à instruire pour la décision

- **Rattrapage complet** : une capture par étape, rescore de la Vuelta entière.
  Coûteux en saisie, seul chemin vers une Vuelta juste.
- **Rattrapage ciblé** : seules les étapes où l'écart déplace un classement d'équipe.
- **Acceptation** : clôture propre sur les finaux, marge d'erreur documentée et
  annoncée aux joueurs.

## Piège

Rescorer une ancienne étape fait dériver l'XP des **autres** équipes par code-drift
— le code de scoring a changé depuis l'import initial. Précédent documenté au
backfill Giro (Rubio/Arrieta, 2026-06-04). Toute option de rattrapage doit diffusée
un diff avant/après sur **toutes** les équipes, pas seulement celles visées.

## Comments

### 2026-09-14

Le chiffrage est fait et il est **mesuré, pas extrapolé** : voir `08-etat-vuelta-2026-et-decision-rescore.md`. 54 rangs faux sur 16 étapes, 31 touchant un contrat, places 3/4/5/7 de la Vuelta en jeu.
