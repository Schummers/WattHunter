# 05 — Rescore local scopé Tour, diff des 9 équipes

**What to build:** le chiffre réel. Le Tour rescoré au code d'aujourd'hui sur
une base locale où les rangs sont justes et les événements présents, avec un
diff qui rend chaque XP déplacé explicable. Ce ticket se termine par une
lecture humaine, pas par une écriture.

**Blocked by:** 03, 04.

**Status:** ready-for-agent → `ready-for-human` à la fin

- [ ] Baseline pris après 03 et 04, avant le rescore
- [ ] Rescore via `calculate_daily_scores` scopé aux 24 slugs du périmètre (étapes 2-21 + gc + points/kom/youth), étape par étape puis finaux, jamais de rescore large
- [ ] `stage-1` : lignes `rider_xp_daily` identiques au baseline. Si le moteur les touche, le ticket le dit et ne conclut pas avant de comprendre
- [ ] Diff par équipe sur les 9 équipes : `cumulative_xp`, `level`, total `rider_xp_daily` par slug, lignes `team_ranking_daily` réécrites. Aucune équipe hors ligue V2 touchée
- [ ] Le diff est confronté à la projection D du diagnostic : part « finaux » égale au drift mesuré à ±1 XP, part « rangs » égale au delta bug à ±1 XP, part « événements » dans la fourchette 602-1204. Tout résidu au-delà est expliqué ligne à ligne ou le ticket échoue
- [ ] Classement du Tour et classement cumulé, avant / après, en deux tableaux lisibles ; les places qui changent sont nommées avec leur cause (barème, événements, rangs)
- [ ] Aucun `level` ne régresse (grandfather) ; tout level-up est listé
- [ ] `team_ranking_daily` : les dates de juillet réécrites sont listées ; le ticket dit explicitement que l'historique de classement change
- [ ] Rapport court écrit dans ce ticket, statut passé à `ready-for-human`. **Aucune écriture prod tant que l'utilisateur n'a pas validé le rapport.**
