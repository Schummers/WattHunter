-- Recompute every rider's monthly_salary with the new salary multiplier (2000 -> 2500).
-- monthly_salary is the auction minimum-bid floor (GAME_RULES §4.4): max(5000, floor(pts * 2500 / 12 / 1000) * 1000).
-- Applies to the whole rider pool (both game modes share the riders table). Idempotent:
-- re-running yields the same values for unchanged pcs_points_1yr.
-- This covers riders not refreshed by the top-300 scrape (e.g. Tour startlist riders ranked > 300):
-- they keep their last-known pcs_points_1yr but get the new multiplier.

UPDATE public.riders
SET monthly_salary = GREATEST(5000, FLOOR(pcs_points_1yr * 2500 / 12 / 1000) * 1000)
WHERE pcs_points_1yr > 0;
