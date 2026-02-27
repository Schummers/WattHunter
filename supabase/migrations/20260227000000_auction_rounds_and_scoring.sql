-- =============================================================
-- Migration: Support 3-round sealed-bid auctions + daily scoring
-- =============================================================

-- 1. auction_bids: add round column
ALTER TABLE auction_bids
  ADD COLUMN round int NOT NULL DEFAULT 1
  CHECK (round BETWEEN 1 AND 3);

-- 2. auction_bids: replace is_winning boolean with status enum
ALTER TABLE auction_bids
  ADD COLUMN status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'won', 'outbid', 'cancelled'));

-- Migrate existing data: is_winning=true → 'won', false → 'active'
UPDATE auction_bids SET status = 'won' WHERE is_winning = true;
UPDATE auction_bids SET status = 'active' WHERE is_winning = false;

-- Drop old column
ALTER TABLE auction_bids DROP COLUMN is_winning;

-- 3. Unique constraint: one active bid per player per rider per round
CREATE UNIQUE INDEX auction_bids_unique_per_round
  ON auction_bids(auction_id, rider_id, team_id, round)
  WHERE status = 'active';

-- 4. rider_pcs_history: add points_delta for actual race points earned
ALTER TABLE rider_pcs_history
  ADD COLUMN points_delta int NOT NULL DEFAULT 0;

-- 5. Update RLS for auction_bids (allow players to insert/update their own bids)
-- Players can insert bids for their own team during open auctions
CREATE POLICY auction_bids_insert ON auction_bids
  FOR INSERT TO authenticated
  WITH CHECK (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
    AND auction_id IN (SELECT id FROM auctions WHERE status = 'open')
  );

-- Players can update (cancel) their own active bids
CREATE POLICY auction_bids_update ON auction_bids
  FOR UPDATE TO authenticated
  USING (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
    AND status = 'active'
  )
  WITH CHECK (
    status IN ('active', 'cancelled')
  );
