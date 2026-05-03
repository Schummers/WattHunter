-- supabase/migrations/20260501100000_xp_stretched_curve_recompute.sql
-- Apply Anti-Runaway Mech 3 stretched XP curve to existing teams.
-- New thresholds (source of truth: apps/web/lib/levels.ts and services/pcs-sync/scoring.py):
-- L1=0, L2=25, L3=150, L4=350, L5=600, L6=1200, L7=1800, L8=2400
-- Old DB thresholds were L6=900, L7=1500, L8=2000.

-- 1. Reusable function — single source of truth going forward.
CREATE OR REPLACE FUNCTION public.compute_level(xp numeric) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN xp >= 2400 THEN 8
    WHEN xp >= 1800 THEN 7
    WHEN xp >= 1200 THEN 6
    WHEN xp >=  600 THEN 5
    WHEN xp >=  350 THEN 4
    WHEN xp >=  150 THEN 3
    WHEN xp >=   25 THEN 2
    ELSE 1
  END;
$$;

-- 2. Recompute team levels using the new curve.
UPDATE public.teams SET level = public.compute_level(cumulative_xp);
