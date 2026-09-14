# 02 — Outillage de correction à cible explicite

**What to build:** un script de correction dérivé du pattern Vuelta (baseline,
ré-import depuis le cache, rescore scopé, diff), qui ne connaît que deux cibles,
`local` et `prod`, et refuse la prod sans flag explicite. Le même script sert au
ticket 5 (local) et au ticket 6 (prod) : ce qui a été validé est ce qui est rejoué.

**Blocked by:** None — can start immediately (parallèle au 01).

**Status:** ready-for-agent

- [ ] Paramètre de cible obligatoire ; la prod exige en plus un flag d'écriture explicite, sinon le script s'arrête après le baseline (dry-run)
- [ ] Baseline : snapshot daté de `race_results`, `gt_final_classifications`, `stage_event_results`, `rider_xp_daily`, `teams` (cumulative_xp, level) et `team_ranking_daily`, restreint aux slugs Tour et aux 9 équipes de la ligue Classic V2, écrit sur disque avant toute écriture
- [ ] Le fetch HTML est remplacé par une lecture de `fixtures/sweep-tdf/` ; toute URL absente du cache fait échouer le script au lieu de scraper en direct
- [ ] Périmètre figé dans le code : étapes **2 à 21** + `gc` + `points` / `kom` / `youth`. `stage-1` est explicitement exclue avec le commentaire qui dit pourquoi (positions au général stockées, page PCS par équipes)
- [ ] `race_date` de chaque étape lue dans `stage_profiles`, jamais la date de clôture (incident Vuelta, runbook `vuelta2026-closeout-2026-09-14.md`)
- [ ] Étapes séparées et appelables une à une : `baseline`, `reimport`, `import-events`, `rescore`, `diff`, pour que les tickets 3, 4, 5 les enchaînent sans code supplémentaire
- [ ] Le diff compare deux snapshots et sort, par équipe, les deltas de `cumulative_xp`, `level`, du total `rider_xp_daily` par slug, et le nombre de lignes de `team_ranking_daily` réécrites
- [ ] Dry-run exécuté contre le local (une fois le 01 livré) : s'arrête après le baseline, aucune écriture
