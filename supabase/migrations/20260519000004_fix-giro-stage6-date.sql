-- Fix incorrect race_date for Giro d'Italia 2026 Stage 6.
-- Pipeline computed date as start + (6-1) = 2026-05-13, ignoring the rest day
-- on 2026-05-11. Correct date is 2026-05-14.

UPDATE race_results
SET race_date = '2026-05-14'
WHERE race_slug = 'race/giro-d-italia/2026/stage-6'
  AND race_date = '2026-05-13';

UPDATE rider_xp_daily
SET date = '2026-05-14'
WHERE race_slug = 'race/giro-d-italia/2026/stage-6'
  AND date = '2026-05-13';
