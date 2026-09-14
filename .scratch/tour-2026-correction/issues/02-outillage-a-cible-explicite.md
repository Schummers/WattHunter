# 02 — Outillage de correction à cible explicite

**What to build:** un script de correction dérivé du pattern Vuelta (baseline,
ré-import depuis le cache, rescore scopé, diff), qui ne connaît que deux cibles,
`local` et `prod`, et refuse la prod sans flag explicite. Le même script sert au
ticket 5 (local) et au ticket 6 (prod) : ce qui a été validé est ce qui est rejoué.

**Blocked by:** None — can start immediately (parallèle au 01).

**Status:** ready-for-human (7/8 — le dry-run local attend le ticket 01)

- [x] Paramètre de cible obligatoire ; la prod exige en plus un flag d'écriture explicite, sinon le script s'arrête après le baseline (dry-run)
- [x] Baseline : snapshot daté de `race_results`, `gt_final_classifications`, `stage_event_results`, `rider_xp_daily`, `teams` (cumulative_xp, level) et `team_ranking_daily`, restreint aux slugs Tour et aux 9 équipes de la ligue Classic V2, écrit sur disque avant toute écriture
- [x] Le fetch HTML est remplacé par une lecture de `fixtures/sweep-tdf/` ; toute URL absente du cache fait échouer le script au lieu de scraper en direct
- [x] Périmètre figé dans le code : étapes **2 à 21** + `gc` + `points` / `kom` / `youth`. `stage-1` est explicitement exclue avec le commentaire qui dit pourquoi (positions au général stockées, page PCS par équipes)
- [x] `race_date` de chaque étape lue dans `stage_profiles`, jamais la date de clôture (incident Vuelta, runbook `vuelta2026-closeout-2026-09-14.md`)
- [x] Étapes séparées et appelables une à une : `baseline`, `reimport`, `import-events`, `rescore`, `diff`, pour que les tickets 3, 4, 5 les enchaînent sans code supplémentaire
- [x] Le diff compare deux snapshots et sort, par équipe, les deltas de `cumulative_xp`, `level`, du total `rider_xp_daily` par slug, et le nombre de lignes de `team_ranking_daily` réécrites
- [ ] Dry-run exécuté contre le local (une fois le 01 livré) : s'arrête après le baseline, aucune écriture

## Livré

`.scratch/tour-2026-correction/correct_tdf2026.py`, cinq étapes appelables une à une :

```bash
cd services/pcs-sync
.venv/bin/python ../../.scratch/tour-2026-correction/correct_tdf2026.py \
  <baseline|reimport|import-events|rescore> --target local
.venv/bin/python ../../.scratch/tour-2026-correction/correct_tdf2026.py \
  diff --before <snap>.json --after <snap>.json
```

Snapshots datés dans `.scratch/tour-2026-correction/snapshots/`.

### Ce qui a été vérifié à l'exécution

| Point | Preuve |
|---|---|
| `--target` obligatoire | `argparse` sort en erreur sans lui, il n'y a pas de défaut |
| `local` sans stack | message explicite renvoyant au ticket 01, pas de fallback silencieux |
| `prod` sans `--write` | branche dry-run : baseline puis arrêt, avant toute écriture |
| `.env` prod qui pointerait en local | refus explicite sur `127.0.0.1` / `localhost` |
| fetch remplacé par le cache | `sync.fetch_html` **et** `sync_race.fetch_html` repointés, vérifié après patch |
| URL hors cache | `SystemExit`, jamais de scrape direct |
| le cache parse par le chemin de prod | `stage-5` relu → top 5 Kooij / Kanter / Merlier / Artz / Philipsen |
| périmètre | 24 slugs scorés, `stage-1` absente (vérifié à l'exécution) |

### Deux choix de conception qui ne sont dans aucune case

- **Un appel de scoring par slug.** `calculate_daily_scores` calcule un cutoff
  unique par appel, depuis la date du **premier** slug reçu (« all slugs in one
  call share a date », `scoring.py:709`). Passer les 24 slugs ensemble les
  scorerait tous avec l'escouade du jour de l'étape 2. C'est le gotcha
  « une étape par appel » de la clôture Vuelta, rendu structurel ici.
- **Chaque étape d'écriture prend son propre baseline**, pas seulement la
  première. Un enchaînement 3 → 4 → 5 laisse donc un couple `avant-` / `après-`
  par étape, et `diff` accepte n'importe quel couple de snapshots.

### Reste ouvert

La dernière case, le dry-run contre le local, attend que le ticket 01 ait une base.
