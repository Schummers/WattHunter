-- Rollback: restore the pre-stretch curve (L7=1800, L8=2400).
-- NOTE: the no-regression recompute is NOT reversible (old per-team levels are
-- not stored); this only restores the function and re-applies GREATEST.
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

UPDATE public.teams
   SET level = GREATEST(level, public.compute_level(cumulative_xp));
