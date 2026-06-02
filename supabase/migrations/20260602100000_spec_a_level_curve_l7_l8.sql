-- Spec A (A1) — stretch L7/L8 thresholds.
-- New: L7 = 2600 (was 1800), L8 = 5000 (was 2400). L1-L6 unchanged.
-- Source of truth: apps/web/lib/levels.ts and services/pcs-sync/scoring.py.

CREATE OR REPLACE FUNCTION public.compute_level(xp numeric) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN xp >= 5000 THEN 8
    WHEN xp >= 2600 THEN 7
    WHEN xp >= 1200 THEN 6
    WHEN xp >=  600 THEN 5
    WHEN xp >=  350 THEN 4
    WHEN xp >=  150 THEN 3
    WHEN xp >=   25 THEN 2
    ELSE 1
  END;
$$;

-- Recompute team levels with NO-REGRESSION: never lower a team below its
-- current level (grandfather rule, matches scoring.py runtime behaviour).
UPDATE public.teams
   SET level = GREATEST(level, public.compute_level(cumulative_xp));
