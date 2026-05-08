-- supabase/migrations/20260508010000_gt_tactics_traceability.sql
-- Adds columns to rider_xp_daily so every component of the GT scoring
-- formula is stored: xp_gained = (raw_pcs_points × gt_role_mult × (1 + strategy_bonus)
-- + gt_classif_bonus) × remontada_mult × nemesis_modifier

ALTER TABLE rider_xp_daily
  ADD COLUMN IF NOT EXISTS gt_role_mult     NUMERIC(3,1) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS gt_classif_bonus INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nemesis_modifier NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS tactic_applied   TEXT;

COMMENT ON COLUMN rider_xp_daily.gt_role_mult IS
  'Effective GT role multiplier applied (1.0 domestique, 1.5 most roles, 2.0 TT-on-ITT/Overdrive/Nemesis-attacker-won)';
COMMENT ON COLUMN rider_xp_daily.gt_classif_bonus IS
  'Daily classification bonus points (GC top10, points top5, KOM top3, ×1.5 if role-match)';
COMMENT ON COLUMN rider_xp_daily.nemesis_modifier IS
  'Nemesis duel modifier: 0.5 target lost, 0.75 attacker lost, 1.0 default, 1.25 target won';
COMMENT ON COLUMN rider_xp_daily.tactic_applied IS
  'Which tactic affected this rider on this stage (NULL if none)';
