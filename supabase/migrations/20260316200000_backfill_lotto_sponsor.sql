-- Backfill: assign Lotto as secondary sponsor for teams that have no team_sponsors rows.
-- This covers teams created before the auto-assign code was added.
INSERT INTO public.team_sponsors (team_id, sponsor_id, slot)
SELECT t.id, s.id, 'secondary'
FROM public.teams t
CROSS JOIN public.sponsors s
WHERE s.name = 'Lotto'
AND NOT EXISTS (
  SELECT 1 FROM public.team_sponsors ts WHERE ts.team_id = t.id
);
