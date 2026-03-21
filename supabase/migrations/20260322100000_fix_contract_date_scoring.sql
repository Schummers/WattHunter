-- Fix: delete rider_xp_daily entries where race happened outside contract period.
-- Riders should only earn XP for races during [purchased_at, release_date].

-- 1. Delete entries where race happened BEFORE contract started
DELETE FROM rider_xp_daily rxd
USING contracts c, race_results rr
WHERE rxd.contract_id = c.id
  AND rxd.rider_id = rr.rider_id
  AND rxd.race_slug = rr.race_slug
  AND rr.race_date < c.purchased_at::date;

-- 2. Delete entries where race happened AFTER contract was released
DELETE FROM rider_xp_daily rxd
USING contracts c, race_results rr
WHERE rxd.contract_id = c.id
  AND c.release_date IS NOT NULL
  AND rxd.rider_id = rr.rider_id
  AND rxd.race_slug = rr.race_slug
  AND rr.race_date > c.release_date;

-- 3. Recalculate teams.cumulative_xp from cleaned rider_xp_daily
UPDATE teams t
SET cumulative_xp = COALESCE(sub.total_xp, 0)
FROM (
  SELECT team_id, SUM(xp_gained) AS total_xp
  FROM rider_xp_daily
  GROUP BY team_id
) sub
WHERE t.id = sub.team_id;

-- Zero out teams with no remaining XP entries
UPDATE teams
SET cumulative_xp = 0
WHERE id NOT IN (SELECT DISTINCT team_id FROM rider_xp_daily);

-- 4. Recalculate teams.level from cumulative_xp
UPDATE teams SET level = CASE
  WHEN cumulative_xp >= 2500 THEN 10
  WHEN cumulative_xp >= 1900 THEN 9
  WHEN cumulative_xp >= 1400 THEN 8
  WHEN cumulative_xp >= 1000 THEN 7
  WHEN cumulative_xp >= 700  THEN 6
  WHEN cumulative_xp >= 500  THEN 5
  WHEN cumulative_xp >= 300  THEN 4
  WHEN cumulative_xp >= 150  THEN 3
  WHEN cumulative_xp >= 50   THEN 2
  ELSE 1
END;
