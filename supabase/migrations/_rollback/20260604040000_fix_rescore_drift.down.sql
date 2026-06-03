-- Rollback for 20260604030000_fix_rescore_drift.sql
-- Restores the post-rescore (drifted) cumulative_xp values and removes the audit rows.

ALTER TABLE public.teams DISABLE TRIGGER teams_protect_sensitive_fields;

UPDATE public.teams SET cumulative_xp = 1536.88 WHERE id = '75122355-d629-4f10-927c-2eedc17883cd'; -- Dixon Hormous
UPDATE public.teams SET cumulative_xp = 2512.94 WHERE id = '3935c0aa-12d5-4ef9-a04d-84de12977c1c'; -- Leopard_Trek
UPDATE public.teams SET cumulative_xp = 2062.24 WHERE id = 'd33c4106-6fc2-49b5-a60e-a609ee963d6f'; -- TheAussieMate
UPDATE public.teams SET cumulative_xp = 2633.66 WHERE id = '68ccf635-6599-4d53-a112-de66b27fa4cf'; -- Klimax
UPDATE public.teams SET cumulative_xp = 1808.96 WHERE id = 'dd1dbdb6-cd30-44b4-b62b-2a6a992a286c'; -- GoudalEnergies
UPDATE public.teams SET cumulative_xp = 1654.05 WHERE id = 'd5be67d4-4229-4899-b735-1ac4de12494c'; -- Peejee

ALTER TABLE public.teams ENABLE TRIGGER teams_protect_sensitive_fields;

DELETE FROM public.team_xp_adjustments
WHERE adjusted_at = '2026-06-04'
  AND reason = 'Rescore drift correction (Rubio/Arrieta backfill 20260604020000)';
