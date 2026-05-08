-- Rollback for 20260508010050_fix_gt_classif_bonus_type.sql
-- Reverts gt_classif_bonus from NUMERIC(4,1) back to INT.
-- WARNING: any non-integer values (e.g. 13.5) will be truncated.

ALTER TABLE rider_xp_daily
  ALTER COLUMN gt_classif_bonus TYPE INT;
