-- Fix: Reset payments_count for team_sponsors that have no actual sponsor_payment in treasury_log.
-- The previous migration incorrectly set payments_count = 1 for all existing rows.
UPDATE public.team_sponsors ts
SET payments_count = 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.treasury_log tl
  WHERE tl.team_id = ts.team_id
  AND tl.type = 'sponsor_payment'
);
