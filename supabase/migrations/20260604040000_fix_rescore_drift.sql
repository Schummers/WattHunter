-- Operational correction: undo the code-drift side effect of the Rubio/Arrieta backfill rescore.
--
-- Running scripts/rescore_rubio_arrieta_giro.py re-scored Giro stages 14/17/19/20 + finals gc/kom
-- with the CURRENT scoring code. Besides crediting the intended Rubio (+97, Muscat) and Arrieta
-- (+80, Peejee), it recomputed every other team's existing riders in those races -> their
-- cumulative_xp drifted (the finals were originally scored 2026-06-03 with slightly different code).
--
-- Intended net effect was ONLY: Muscat +97, Peejee +80. This migration restores the 6 collaterally
-- drifted teams to their pre-rescore cumulative_xp (absolute SET = exact pre-rescore standings).
-- Per-rider rider_xp_daily rows for those races keep the recomputed values, but team standings are
-- pinned back to the blessed state. Levels are untouched (all monotonic; no level changed).
--
-- The teams trigger blocks XP edits except for service_role; migrations run as postgres, so we
-- disable it for the correction (same pattern as 20260509120000_fix_round2_treasury_double_count).
-- On a fresh db reset these teams do not exist (gameplay data), so the UPDATEs simply match 0 rows.

ALTER TABLE public.teams DISABLE TRIGGER teams_protect_sensitive_fields;

-- Restore pre-rescore cumulative_xp (absolute target values).
UPDATE public.teams SET cumulative_xp = 1655.63 WHERE id = '75122355-d629-4f10-927c-2eedc17883cd'; -- Dixon Hormous
UPDATE public.teams SET cumulative_xp = 2590.09 WHERE id = '3935c0aa-12d5-4ef9-a04d-84de12977c1c'; -- Leopard_Trek
UPDATE public.teams SET cumulative_xp = 2102.61 WHERE id = 'd33c4106-6fc2-49b5-a60e-a609ee963d6f'; -- TheAussieMate
UPDATE public.teams SET cumulative_xp = 2643.16 WHERE id = '68ccf635-6599-4d53-a112-de66b27fa4cf'; -- Klimax
UPDATE public.teams SET cumulative_xp = 1814.84 WHERE id = 'dd1dbdb6-cd30-44b4-b62b-2a6a992a286c'; -- GoudalEnergies
UPDATE public.teams SET cumulative_xp = 1642.05 WHERE id = 'd5be67d4-4229-4899-b735-1ac4de12494c'; -- Peejee (1562.05 + 80 Arrieta)

ALTER TABLE public.teams ENABLE TRIGGER teams_protect_sensitive_fields;

-- Audit trail for the correction (amount = pre-rescore - drifted).
INSERT INTO public.team_xp_adjustments (team_id, amount, reason, adjusted_at) VALUES
  ('75122355-d629-4f10-927c-2eedc17883cd',  118.75, 'Rescore drift correction (Rubio/Arrieta backfill 20260604020000)', '2026-06-04'),
  ('3935c0aa-12d5-4ef9-a04d-84de12977c1c',   77.15, 'Rescore drift correction (Rubio/Arrieta backfill 20260604020000)', '2026-06-04'),
  ('d33c4106-6fc2-49b5-a60e-a609ee963d6f',   40.37, 'Rescore drift correction (Rubio/Arrieta backfill 20260604020000)', '2026-06-04'),
  ('68ccf635-6599-4d53-a112-de66b27fa4cf',    9.50, 'Rescore drift correction (Rubio/Arrieta backfill 20260604020000)', '2026-06-04'),
  ('dd1dbdb6-cd30-44b4-b62b-2a6a992a286c',    5.88, 'Rescore drift correction (Rubio/Arrieta backfill 20260604020000)', '2026-06-04'),
  ('d5be67d4-4229-4899-b735-1ac4de12494c',  -12.00, 'Rescore drift correction (Rubio/Arrieta backfill 20260604020000)', '2026-06-04');
