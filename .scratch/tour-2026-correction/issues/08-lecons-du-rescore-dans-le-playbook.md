# 08 — Relire le playbook de clôture GT à la lumière du rescore du Tour

**What to build:** le playbook de clôture des Grands Tours et l'ADR sur la
vérification par source indépendante, ouverts dans la PR
[#77](https://github.com/Schummers/WattHunter/pull/77)
(`docs/runbooks/gt-closeout-playbook.md`,
`docs/adr/2026-09-verification-import-par-source-independante.md`), intègrent
ce que la correction du Tour a appris et que la Vuelta ne pouvait pas apprendre :
rescorer une course close des mois plus tôt, sous un barème qui a changé.

**Blocked by:** 06, et PR #77 mergée (sinon, éditer sur sa branche, jamais une
copie parallèle des deux fichiers).

**Status:** ready-for-agent

- [ ] Les deux fichiers de la PR #77 lus en entier avant d'écrire une ligne ; ce ticket amende, il ne réécrit pas et ne réexplique pas le scoring (le §3 pointe vers GAME_RULES §7, ça reste ainsi)
- [ ] Le playbook nomme le drift comme une étape à chiffrer **avant** tout rescore d'une course close : colonnes séparées bug / barème / événements, et la projection du classement cumulé sous chaque option, parce que c'est elle qui a montré que le rescore déplaçait un podium pour une raison sans rapport avec le bug
- [ ] Le playbook dit que les événements (côtes, sprints) se parsent depuis les pages d'étape déjà en cache, sans requête, et que le garde-fou p4/p5 bloque tout rescore d'une course importée avant août 2026 tant qu'ils ne sont pas importés
- [ ] Interdit ajouté : ne jamais ré-importer une étape scorée par contournement (TTT via GC, stage-1 du Tour 2026), la page PCS y donne un classement par équipes
- [ ] Interdit ajouté : pas de rescore d'une course dont la ligue n'a pas les lignes `rider_xp_daily` (Giro 2026 en V2, total figé au seed) ; le playbook renvoie au ticket 07 pour l'écart `cumulative_xp − lignes`
- [ ] La règle « validé en local, rejoué en prod, preuve `prod-après == local-après` » est la procédure standard du playbook pour toute écriture rétroactive, avec le baseline daté comme première étape
- [ ] L'ADR reçoit au plus un paragraphe : la vérification indépendante ne dit rien du barème, et un « 0 écart » de rangs ne prouve pas que le classement affiché est celui qui a été joué
- [ ] Le commentaire « Giro/Tour 2026 keep the old values » de `scoring.py` est vérifié cohérent avec le playbook (le Tour est au barème de septembre depuis le 06, le Giro non)
- [ ] Les chiffres cités viennent du rapport du 05 et du runbook du 06, pas du diagnostic 09, qui était une projection
