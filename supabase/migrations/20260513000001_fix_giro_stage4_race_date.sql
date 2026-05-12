-- Fix Stage 4 race_date: pipeline B was run with wrong date (11/05 instead of 12/05)
UPDATE race_results
SET race_date = '2026-05-12'
WHERE race_slug = 'race/giro-d-italia/2026/stage-4'
  AND race_date = '2026-05-11';
