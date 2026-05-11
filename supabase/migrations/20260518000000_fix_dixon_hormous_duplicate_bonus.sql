-- Fix Dixon Hormous quadruple sponsor bonus for Giro stage 2.
--
-- Bug: the scoring pipeline credited "stage rank 3 in giro-d-italia/2026/stage-2"
-- 4 times instead of once on 2026-05-10, adding 75 000 € to Dixon's treasury.
--
-- This migration:
-- 1. Deletes 3 of the 4 duplicate treasury_log entries (keeps exactly 1).
-- 2. Reduces teams.treasury by 75 000 for Dixon Hormous.
--    Safety guard: only runs if treasury is 100 000 (the corrupted value).

BEGIN;

ALTER TABLE public.teams DISABLE TRIGGER teams_protect_sensitive_fields;

UPDATE public.teams
SET treasury = treasury - 75000
WHERE name = 'Dixon Hormous'
  AND treasury = 100000;

ALTER TABLE public.teams ENABLE TRIGGER teams_protect_sensitive_fields;

-- Keep exactly 1 of the 4 identical entries; delete the other 3.
-- Using ctid to target specific rows without a unique id filter.
DELETE FROM public.treasury_log
WHERE id IN (
  SELECT id FROM public.treasury_log
  WHERE team_id = (SELECT id FROM teams WHERE name = 'Dixon Hormous')
    AND type = 'sponsor_bonus'
    AND description = 'Sponsor bonus: stage rank 3 in race/giro-d-italia/2026/stage-2 (×1.25)'
    AND created_at::date = '2026-05-10'
  ORDER BY created_at
  OFFSET 1  -- keep the first, delete the rest
);

COMMIT;
