-- Recalculate team levels from cumulative_xp
-- Fixes stale level values after XP decimal precision migration

UPDATE teams SET level = CASE
  WHEN cumulative_xp >= 2500 THEN 10
  WHEN cumulative_xp >= 1900 THEN 9
  WHEN cumulative_xp >= 1400 THEN 8
  WHEN cumulative_xp >= 1000 THEN 7
  WHEN cumulative_xp >= 700 THEN 6
  WHEN cumulative_xp >= 500 THEN 5
  WHEN cumulative_xp >= 300 THEN 4
  WHEN cumulative_xp >= 150 THEN 3
  WHEN cumulative_xp >= 50 THEN 2
  ELSE 1
END
WHERE level != CASE
  WHEN cumulative_xp >= 2500 THEN 10
  WHEN cumulative_xp >= 1900 THEN 9
  WHEN cumulative_xp >= 1400 THEN 8
  WHEN cumulative_xp >= 1000 THEN 7
  WHEN cumulative_xp >= 700 THEN 6
  WHEN cumulative_xp >= 500 THEN 5
  WHEN cumulative_xp >= 300 THEN 4
  WHEN cumulative_xp >= 150 THEN 3
  WHEN cumulative_xp >= 50 THEN 2
  ELSE 1
END;
