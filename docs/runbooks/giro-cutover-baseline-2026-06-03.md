# Giro Cutover — Baseline prod (snapshot read-only avant étape 21)

Capturé le 2026-06-03 via `/tmp/snapshot_giro_cutover.py` (read-only, aucune écriture).
Sert de référence d'audit/rollback pour le cutover (cf. `docs/runbooks/2026-06-03-giro-cutover.md`).

## État Giro avant cutover
- `race_results` : 2676 lignes, stages 1-20 présents. **stage-21 ABSENT**, **/gc ABSENT**.
- `gt_final_classifications` : **0 ligne** (finals pas encore importés).
- `rider_xp_daily` : 577 lignes, stages 1-20 tous scorés.
- Migrations Spec C `20260603120000` + `20260603130000` : **pending** (table `sponsors` = ancien barème).

## sponsor_bonuses (Giro) — AVANT
- 58 lignes, toutes `result_type=stage`, **total final_bonus = 1 205 000**.

## sponsor_goal_completions (`race/giro-d-italia/2026`) — AVANT
- 8 lignes, **total final_reward = 380 000** :
  - `idx=4` "Win a stage" base=50000 ×1.0 → 50000  (×4 occurrences)
  - `idx=4` "Win an ITT" base=50000 ×1.0 → 50000  (×2)
  - `idx=5` "Wear ciclamino" base=40000 ×1.0 → 40000  (×2)

## teams treasury / cumulative_xp — AVANT (3 ligues)
Ligue demo `00000000-0000-4000-8000-d3110d3110d3` :
- Flamme Rouge 263150 / xp 2073.89 / L7
- Les Grimpeurs 155500 / 1609.03 / L6
- Cinq Etoiles 42000 / 1152.4 / L5
- Bidon Vert 67050 / 1079.51 / L5
- Echappee Belle 40050 / 1033.48 / L5
- Pave Royal 110000 / 958.21 / L5
- Maillot Jaune 139900 / 921.5 / L5
- Domestique XI 203000 / 689.96 / L5

Ligue réelle `adaec367-784a-4580-8001-52405a2df5b9` :
- Leopard_Trek 283150 / xp 2193.59 / L7
- Klimax 195500 / 1896.66 / L7
- Peejee 67000 / 1226.65 / L6
- TheAussieMate 67050 / 1215.61 / L6
- Dixon Hormous 160000 / 1112.38 / L5
- GoudalEnergies 40050 / 1105.39 / L5
- Muscat Romain 139900 / 929.38 / L5
- bigdaddy 203000 / 714.26 / L5

Ligue `fcd0d092-c876-47a1-9247-340db21a3eab` :
- Jonathan Schummers 0 / 350.0 / L4

## ✅ Point de vigilance idempotence — VÉRIFIÉ (résolu)
Vérifié via `/tmp/check_goal_idempotency.py` : les 8 completions existantes appartiennent
toutes à `decathlon` et `ineos` (aucune `soudal`/`lidl-trek`). Le backfill `goal_key`
(`20260603130000`) les mappe vers des clés RÉELLES :
- decathlon idx4 "Win a stage" → `sprint_win_stage`
- ineos idx4 "Win an ITT" → `clm_win_itt`
- decathlon idx5 "Wear ciclamino" → `sprint_points_jersey`
→ `evaluate-goals` (Étape 4) les verra comme déjà complétées : **aucun re-crédit**. Pas de
clé synthétique. Idempotence du cutover confirmée. `reconcile` (Étape 5) reste le filet de sécurité.
