-- supabase/migrations/20260508010050_fix_gt_classif_bonus_type.sql
-- Fixes gt_classif_bonus column type from INT to NUMERIC(4,1).
-- The _classif_bonus() helper in scoring.py produces fractional values
-- (e.g. GC rank 2 with gc_leader role: (11-2) × 1.5 = 13.5).
-- PostgREST rejects floats inserted into INT columns, breaking production scoring
-- for GC leaders finishing 2/4/6/8/10, sprinters finishing 1/3/5, climbers finishing 1/3.

ALTER TABLE rider_xp_daily
  ALTER COLUMN gt_classif_bonus TYPE NUMERIC(4,1);

COMMENT ON COLUMN rider_xp_daily.gt_classif_bonus IS
  'Daily classification bonus points (GC top10, points top5, KOM top3, ×1.5 if role-match) — NUMERIC(4,1) for half-point precision';
