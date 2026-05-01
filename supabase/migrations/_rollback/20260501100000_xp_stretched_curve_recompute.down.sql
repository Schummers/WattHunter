-- supabase/migrations/_rollback/20260501100000_xp_stretched_curve_recompute.down.sql
-- Manual rollback only — restores the previous (April 2nd) levels.
-- DO NOT auto-apply.

UPDATE public.teams SET level = CASE
  WHEN cumulative_xp >= 2000 THEN 8
  WHEN cumulative_xp >= 1500 THEN 7
  WHEN cumulative_xp >=  900 THEN 6
  WHEN cumulative_xp >=  600 THEN 5
  WHEN cumulative_xp >=  350 THEN 4
  WHEN cumulative_xp >=  150 THEN 3
  WHEN cumulative_xp >=   25 THEN 2
  ELSE 1
END;

DROP FUNCTION IF EXISTS public.compute_level(numeric);
