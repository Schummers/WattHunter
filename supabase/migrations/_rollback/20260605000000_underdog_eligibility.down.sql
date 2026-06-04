DROP FUNCTION IF EXISTS public.recompute_underdog_eligibility(int, int);
DROP TABLE IF EXISTS public.underdog_eligibility;
ALTER TABLE public.teams DROP COLUMN IF EXISTS underdog_eligible;
