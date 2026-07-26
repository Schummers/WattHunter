-- Rollback: restore the pre-fix (rest-day-free) Tour de France 2026 stage dates.
-- Only useful to reproduce the original bug; the dates below are the WRONG ones.

UPDATE public.race_results SET race_date = '2026-07-13' WHERE race_slug = 'race/tour-de-france/2026/stage-10';
UPDATE public.race_results SET race_date = '2026-07-14' WHERE race_slug = 'race/tour-de-france/2026/stage-11';
UPDATE public.race_results SET race_date = '2026-07-15' WHERE race_slug = 'race/tour-de-france/2026/stage-12';
UPDATE public.race_results SET race_date = '2026-07-16' WHERE race_slug = 'race/tour-de-france/2026/stage-13';
UPDATE public.race_results SET race_date = '2026-07-17' WHERE race_slug = 'race/tour-de-france/2026/stage-14';
UPDATE public.race_results SET race_date = '2026-07-18' WHERE race_slug = 'race/tour-de-france/2026/stage-15';
UPDATE public.race_results SET race_date = '2026-07-19' WHERE race_slug = 'race/tour-de-france/2026/stage-16';
UPDATE public.race_results SET race_date = '2026-07-20' WHERE race_slug = 'race/tour-de-france/2026/stage-17';
UPDATE public.race_results SET race_date = '2026-07-21' WHERE race_slug = 'race/tour-de-france/2026/stage-18';
UPDATE public.race_results SET race_date = '2026-07-22' WHERE race_slug = 'race/tour-de-france/2026/stage-19';
UPDATE public.race_results SET race_date = '2026-07-23' WHERE race_slug = 'race/tour-de-france/2026/stage-20';
