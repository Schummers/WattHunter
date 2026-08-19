-- Recompute every rider's monthly_salary with the new salary multiplier (2500 -> 2700).
-- monthly_salary is the auction minimum-bid floor (GAME_RULES §4.4): max(5000, floor(pts * 2700 / 12 / 1000) * 1000).
-- Raised ahead of the Vuelta phase so the flat 2M classic budget stays scarce.
-- Applies to the whole rider pool (both game modes share the riders table). Idempotent:
-- re-running yields the same values for unchanged pcs_points_1yr.
-- This covers riders not refreshed by the top-600 scrape (e.g. Vuelta startlist riders ranked > 600):
-- they keep their last-known pcs_points_1yr but get the new multiplier.
-- Mirrors 20260630120000_recompute_salaries_multiplier_2500.sql.

UPDATE public.riders
SET monthly_salary = GREATEST(5000, FLOOR(pcs_points_1yr * 2700 / 12 / 1000) * 1000)
WHERE pcs_points_1yr > 0;
