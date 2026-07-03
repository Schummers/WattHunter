-- Rollback: drop the domestique assist traceability column.
ALTER TABLE public.rider_xp_daily
  DROP COLUMN IF EXISTS assist_bonus;
