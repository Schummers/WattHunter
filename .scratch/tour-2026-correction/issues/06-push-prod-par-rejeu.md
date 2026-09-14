# 06 — Push prod par rejeu, pas par ré-exécution

**What to build:** la prod reçoit exactement ce qui a été validé en local :
mêmes scripts, mêmes pages en cache, même périmètre, et une preuve d'égalité
prod-après / local-après avant de déclarer terminé. Puis la documentation qui
empêche l'incident suivant.

**Blocked by:** 05 **et** validation explicite de l'utilisateur sur son rapport.

**Status:** ready-for-agent (après feu vert)

- [ ] Baseline prod pris avec l'outil du 02, écrit sur disque, date notée
- [ ] Vérifié avant d'écrire : les compteurs de lignes prod des tables du périmètre sont identiques à ceux du dump du 01 (personne n'a écrit entre-temps) ; sinon, stop et re-dump
- [ ] Enchaînement `reimport` → `import-events` → `rescore` en `--target prod` avec le flag d'écriture explicite, dans cet ordre, depuis le cache
- [ ] Preuve centrale : diff `prod-après` vs `local-après` du 05 sur `race_results`, `gt_final_classifications`, `stage_event_results`, `rider_xp_daily`, `teams` (9 équipes) = **0 ligne**. Tout écart arrête le ticket
- [ ] Crosscheck Wikipedia sur la prod : 0 / 198. Balayage zone scorée : 0 / 454
- [ ] L'écran Ranking (Tour de France 2026 et cumulé) affiche les valeurs du rapport du 05
- [ ] Ticket `pcs-import-integrity/09` passé en `done` avec un lien vers ce ticket
- [ ] Runbook `docs/runbooks/tdf2026-correction-<date>.md` : ce qui a été fait, les chiffres avant / après, la commande de rejeu, et la marge résiduelle (rangs 11-20 validés par le correctif seul)
- [ ] `scoring.py` : le commentaire « Giro/Tour 2026 keep the old values » corrigé (le Tour est désormais au barème de septembre, seul le Giro reste à l'ancien) ; `GAME_RULES.md` §7 note la même chose
- [ ] Mémoire projet : une ligne dans `MEMORY.md` (Tour 2026 rescoré au barème actuel le <date>, podium cumulé modifié, Giro toujours à l'ancien barème)
- [ ] Un mot aux joueurs préparé (podium cumulé modifié, cause : barème + rangs corrigés), à envoyer par l'utilisateur
