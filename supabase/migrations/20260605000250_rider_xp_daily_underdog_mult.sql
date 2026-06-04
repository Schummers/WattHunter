-- Spec B (B2) — record the underdog rank-based boost separately from gt_role_mult
-- (which is NUMERIC(3,1) and would truncate 2-decimal boosts).
ALTER TABLE public.rider_xp_daily
  ADD COLUMN IF NOT EXISTS underdog_mult NUMERIC(3,2) NOT NULL DEFAULT 1.0;
