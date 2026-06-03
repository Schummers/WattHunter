# Giro Cutover Runbook (Spec C — Grandfather)

Goal: stage results (incl. stage 21) keep the OLD barème; final classifications
(GC/points/KOM/youth) use the NEW barème. No claw-back of paid bonuses.

## Order of operations (LOCAL, residential IP)

1. **BEFORE deploying the new barème** — sync Giro stage 21 on the CURRENT (old) code:
   `git checkout main && .venv/bin/python run_pipeline.py post-race --race "race/giro-d-italia/2026/stage-21"`
   → bakes stage-21 stage bonus + "Win a stage" goal at OLD amounts (e.g. Milan 20k + 50k = 70k).
2. **Deploy new barème**: confirm with user → `supabase db push --linked` (sponsors migration + goal_key migration) → merge the Spec C branch.
3. **Sync the Giro FINAL classifications** on the NEW code:
   `.venv/bin/python run_pipeline.py post-race --race "race/giro-d-italia/2026/gc"`
   (imports gt_final_classifications via import_final_classifications) then
   `.venv/bin/python run_pipeline.py evaluate-goals --race "race/giro-d-italia/2026"`
   → GC podium/top5/Race Leader/youth + points/KOM finals at NEW amounts (podium GC 60k, not 150k).
4. **Reconcile**: run reconcile_bonuses (find_points_double_counts + reconcile_team_treasury) → review treasury deltas + double-count flags. Any flag → manual revert via a `sponsor_bonus_revert` treasury_log line (audited).

## Idempotency notes
- sponsor_bonuses is idempotent on (team_id, rider_id, race_slug, result_type).
- sponsor_goal_completions is idempotent on (team_id, sponsor_id, goal_key) per race_slug (sole unique index `idx_goal_completions_key`; `goal_key` is NOT NULL; the legacy goal_index index `idx_goal_completions_dedup` is dropped so the two can't disagree).
- Pre-existing Giro stage/goal completions are NOT re-credited (grandfathered): the goal_key migration backfills every legacy row deterministically by `(sponsor, legacy goal_index)` → new key (mirrors GT_GOALS ↔ SPONSOR_GOAL_SETS), so a re-run after cutover is fully idempotent regardless of label.

## Known limitation
- 1-week stage-race squad scoping is resolved by phase_id+year (shared with scoring.py), NOT race_slug — a separate fix is required before 1-week sponsor goals pay out correctly (tracked separately).
