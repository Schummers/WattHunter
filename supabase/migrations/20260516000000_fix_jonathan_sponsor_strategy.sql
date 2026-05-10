-- Admin fix : apply pending sponsor + strategy changes for team Leopard_Trek
-- (Jonathan Schummers, team_id 3935c0aa-12d5-4ef9-a04d-84de12977c1c)
-- Applied immediately instead of waiting for next phase.

-- 1. Change sponsor Lidl-Trek → Decathlon AG2R
UPDATE team_sponsors
SET sponsor_id = (SELECT id FROM sponsors WHERE slug = 'decathlon')
WHERE team_id = '3935c0aa-12d5-4ef9-a04d-84de12977c1c';

-- 2. Deactivate National Pride immediately (was pending=false)
UPDATE team_strategies
SET
  is_active         = false,
  pending_is_active = NULL,
  pending_config    = NULL
WHERE team_id    = '3935c0aa-12d5-4ef9-a04d-84de12977c1c'
  AND strategy_id = (SELECT id FROM strategies WHERE slug = 'national_pride');

-- 3. Activate Team Chemistry immediately (was pending=true)
UPDATE team_strategies
SET
  is_active         = true,
  config            = '{"team": "Red Bull - BORA - hansgrohe"}',
  pending_is_active = NULL,
  pending_config    = NULL
WHERE team_id    = '3935c0aa-12d5-4ef9-a04d-84de12977c1c'
  AND strategy_id = (SELECT id FROM strategies WHERE slug = 'team_chemistry');
