-- Fix XP truncation: int → numeric to preserve policy bonus decimals
-- e.g. 10 pcs_points × 1.05 bonus = 10.5 XP (was truncated to 10)

-- rider_xp_daily.xp_gained : int → numeric(8,1)
ALTER TABLE rider_xp_daily ALTER COLUMN xp_gained TYPE numeric(8,1);

-- teams.cumulative_xp : bigint → numeric(10,1)
ALTER TABLE teams ALTER COLUMN cumulative_xp TYPE numeric(10,1);

-- team_ranking_daily.cumulative_xp : bigint → numeric(10,1)
ALTER TABLE team_ranking_daily ALTER COLUMN cumulative_xp TYPE numeric(10,1);
