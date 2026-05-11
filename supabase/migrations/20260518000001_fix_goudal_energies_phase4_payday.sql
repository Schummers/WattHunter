-- Fix GoudalEnergies missing Phase 4 (Giro d'Italia) payday.
--
-- GoudalEnergies joined on 2026-05-06, after Phase 4 started.
-- confirm_phase_setup's late-joiner guard skipped their entire payday:
-- no sponsor income credited, no salaries deducted, but phase_confirmed_id = 4.
--
-- Expected outcome: 71 200 + 750 000 (Decathlon AG2R) − 821 200 (9 contracts) = 0 €
--
-- This migration applies the payday retroactively:
-- 1. Logs sponsor income (+750 000).
-- 2. Logs each active contract salary deduction (9 riders, total −821 200).
-- 3. Updates teams.treasury: net change = −71 200 → final treasury = 0.
--    Safety guard: only runs if treasury is still 71 200.

BEGIN;

ALTER TABLE public.teams DISABLE TRIGGER teams_protect_sensitive_fields;

UPDATE public.teams
SET treasury = treasury + 750000 - 821200
WHERE name = 'GoudalEnergies'
  AND treasury = 71200;

ALTER TABLE public.teams ENABLE TRIGGER teams_protect_sensitive_fields;

-- Log sponsor income
INSERT INTO public.treasury_log (team_id, type, amount, description)
SELECT id,
       'sponsor_payment',
       750000,
       'Sponsor income — Decathlon AG2R (Giro d''Italia) [retroactive fix]'
FROM public.teams
WHERE name = 'GoudalEnergies';

-- Log each active contract salary
INSERT INTO public.treasury_log (team_id, type, amount, description, rider_id)
SELECT c.team_id,
       'payday_salary',
       -c.locked_salary,
       'Salary — ' || r.full_name || ' (Giro d''Italia) [retroactive fix]',
       c.rider_id
FROM public.contracts c
JOIN public.riders r ON r.id = c.rider_id
JOIN public.teams t ON t.id = c.team_id
WHERE t.name = 'GoudalEnergies'
  AND c.status = 'active';

COMMIT;
