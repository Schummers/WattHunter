-- Spec A (A3) — store the stage-hunter breakaway distance bonus (+1 XP / 10 km, additive).
-- Keeps the rider_xp_daily decomposition complete:
--   xp_gained = (raw_pcs_points × gt_role_mult × (1 + strategy_bonus)
--               + gt_classif_bonus + gt_distance_bonus) × nemesis_modifier
ALTER TABLE public.rider_xp_daily
  ADD COLUMN IF NOT EXISTS gt_distance_bonus NUMERIC(5,1) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.rider_xp_daily.gt_distance_bonus IS
  'Stage-hunter breakaway distance bonus: floor(breakaway_kms / 10), additive, not multiplied (Spec A A3). 0 otherwise.';
