-- Increase XP precision from 1 to 2 decimals
-- Avoids Python banker's rounding loss: 5 × 1.05 = 5.25 (not 5.2)

ALTER TABLE rider_xp_daily ALTER COLUMN xp_gained TYPE numeric(8,2);
ALTER TABLE teams ALTER COLUMN cumulative_xp TYPE numeric(10,2);
ALTER TABLE team_ranking_daily ALTER COLUMN cumulative_xp TYPE numeric(10,2);
