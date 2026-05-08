-- supabase/migrations/_rollback/20260508010000_gt_tactics_traceability_rollback.sql
ALTER TABLE rider_xp_daily
  DROP COLUMN IF EXISTS tactic_applied,
  DROP COLUMN IF EXISTS nemesis_modifier,
  DROP COLUMN IF EXISTS gt_classif_bonus,
  DROP COLUMN IF EXISTS gt_role_mult;
