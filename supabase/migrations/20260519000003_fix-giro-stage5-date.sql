-- Fix incorrect race_date for Giro d'Italia 2026 Stage 5.
-- PCS imported the stage with date 2026-05-12 (Stage 4's date), but the actual
-- race day was 2026-05-13. Correcting both race_results and rider_xp_daily so
-- the feed groups Stage 5 under "13 mai" instead of stacking it under Stage 4.

UPDATE race_results
SET race_date = '2026-05-13'
WHERE race_slug = 'race/giro-d-italia/2026/stage-5'
  AND race_date = '2026-05-12';

UPDATE rider_xp_daily
SET date = '2026-05-13'
WHERE race_slug = 'race/giro-d-italia/2026/stage-5'
  AND date = '2026-05-12';
