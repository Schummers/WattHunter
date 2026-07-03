-- 2026-07 GT rank-based barème refonte — domestique assists traceability.
-- assist_bonus: additive XP earned by a squad domestique when a rider of his
-- REAL pro team finishes top 3 of the stage (4/2/1) or holds a GC top 3 spot
-- at the end of the day (3/2/1). No assists on ITT stages.
-- Written by scoring.py alongside the other per-result audit columns.
ALTER TABLE public.rider_xp_daily
  ADD COLUMN IF NOT EXISTS assist_bonus NUMERIC(4,1) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.rider_xp_daily.assist_bonus IS
  'Domestique assist XP (2026-07 refonte): real-team teammate stage top 3 (4/2/1) + GC top 3 (3/2/1), no ITT.';
