# 05 — Rescore complet de la Vuelta 2026 après 01 + 03

Status: `done` (2026-08-28 — rescore EXÉCUTÉ après validation du diff : étapes 2 et 4
uniquement, `role_cutoff` 11h CET par étape, étape 1 exclue (artefacts de cutoff).
18 lignes modifiées, deltas par équipe strictement égaux au dry-run, 0 ligne étape 1
touchée, cohérence `cumulative_xp` == somme des deltas vérifiée sur les 26 équipes.
Vérif manuelle : Pau Miquel 291.6, Gall 115.0. Voir `../rescore-dryrun-2026-08-28.md`.)
Created: 2026-08-27
Blocked by: `01-underdog-mult-scope.md`, `03-event-scoring-terms.md`
(l'issue 04, finaux, n'exige PAS de rescore : les finaux ne sont distribués qu'à la clôture)

## Pourquoi un seul rescore

Les deux changements modifient la même formule. Rescorer deux fois ferait bouger
l'XP des joueurs deux fois pendant la course. On livre 01 + 02 + 03, puis un rescore
unique de toutes les étapes de la Vuelta 2026 déjà courues.

## Gotcha connu — à ne pas oublier

Relancer le scoring sur d'anciennes étapes **fait dériver l'XP des autres équipes**
(code-drift : le code d'aujourd'hui n'est pas celui du jour de l'étape). Historique :
mémoire `giro_xp_backfill_rescore_drift`.

Procédure obligatoire :
1. Snapshot `rider_xp_daily` + `teams.cumulative_xp` **avant**.
2. Rescore.
3. Diff **toutes** les équipes, pas seulement celles qui ont un Underdog — et
   expliquer chaque écart, ou l'annuler.
4. Vérification à la main sur au moins 2 coureurs, comme pour l'étape 1
   (mémoire `vuelta2026_stage1_itt_scoring`, 0 écart).

S'inspirer de `services/pcs-sync/scripts/verify_tdf2026_closeout.py`, qui a servi au
même exercice sur le Tour, et le tenir à jour avec la nouvelle formule (voir issue 01).

## Communication joueurs

Le retour vient d'un joueur qui a lui-même trouvé le bug ; prévenir la ligue avant le
rescore, en annonçant que des totaux vont bouger à la baisse pour les Underdogs.

## Périmètre

Étapes courues à ce jour : 1 (ITT — rien à ajouter, aucun col/sprint), 2 et 4
(étape 3 annulée). Le rescore applique le fix underdog ET les nouveaux termes
d'événement en une seule vague.

## Ancien périmètre

Vuelta 2026 uniquement. Giro et Tour sont clos et ne sont pas rescorés
(`docs/runbooks/giro-cutover-postmortem-2026-06-03.md`,
`docs/runbooks/tdf2026-closeout-2026-07-27.md`).
