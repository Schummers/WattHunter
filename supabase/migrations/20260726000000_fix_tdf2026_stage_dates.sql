-- Fix Tour de France 2026 stage dates (rest days were missing from the calendar).
--
-- Root cause: the `race/tour-de-france/2026` entry in services/pcs-sync/wt_calendar_2026.json
-- had no `rest_days` key, so race_meta() fell back to `start_date + (N-1) days`. That produced
-- a rest-day-free calendar, shifting every stage from 10 onward 1-2 days too early.
--
-- The real Tour 2026 has two rest days: 2026-07-13 (after stage 9) and 2026-07-20 (after
-- stage 15). With them, stage 21 lands on 2026-07-26, which matches the calendar end_date.
--
-- Impact this repairs: the GT role cutoff is computed as `race_date at 11:00 Europe/Paris`.
-- With dates 1-2 days early, 113 role assignments made before the real stage were silently
-- excluded from scoring across stages 10-20. Stages 10-20 must be re-scored after this
-- migration so those roles are applied.
--
-- Stages 1-9 already carried the correct dates and are intentionally left untouched.

UPDATE public.race_results SET race_date = '2026-07-14' WHERE race_slug = 'race/tour-de-france/2026/stage-10';
UPDATE public.race_results SET race_date = '2026-07-15' WHERE race_slug = 'race/tour-de-france/2026/stage-11';
UPDATE public.race_results SET race_date = '2026-07-16' WHERE race_slug = 'race/tour-de-france/2026/stage-12';
UPDATE public.race_results SET race_date = '2026-07-17' WHERE race_slug = 'race/tour-de-france/2026/stage-13';
UPDATE public.race_results SET race_date = '2026-07-18' WHERE race_slug = 'race/tour-de-france/2026/stage-14';
UPDATE public.race_results SET race_date = '2026-07-19' WHERE race_slug = 'race/tour-de-france/2026/stage-15';
UPDATE public.race_results SET race_date = '2026-07-21' WHERE race_slug = 'race/tour-de-france/2026/stage-16';
UPDATE public.race_results SET race_date = '2026-07-22' WHERE race_slug = 'race/tour-de-france/2026/stage-17';
UPDATE public.race_results SET race_date = '2026-07-23' WHERE race_slug = 'race/tour-de-france/2026/stage-18';
UPDATE public.race_results SET race_date = '2026-07-24' WHERE race_slug = 'race/tour-de-france/2026/stage-19';
UPDATE public.race_results SET race_date = '2026-07-25' WHERE race_slug = 'race/tour-de-france/2026/stage-20';
