-- Data repair: Giro rounds incorrectly closed by repeated validate_round calls
-- Leopard_Trek validated 3 times in 2 minutes, skipping all 3 rounds.
-- No contracts were created. auction_bids are safe to cancel.
-- draft_bids remain intact — players can re-validate once Round 1 is open.

-- 1. Cancel all auction_bids from the 3 Giro rounds (all from Leopard_Trek, all 'active')
UPDATE public.auction_bids
SET status = 'cancelled'
WHERE auction_id IN (
  '6f34592f-5e74-4a52-b03c-ed195d16fdbf',  -- Giro Round 1
  '603133c3-1bd4-41e3-8e29-5aadf225c9d1',  -- Giro Round 2
  '1619df21-f5e1-4f6d-863b-f71011b61338'   -- Giro Round 3
)
AND status = 'active';

-- 2. Reopen Round 1
UPDATE public.auctions
SET status = 'open', resolved_at = NULL
WHERE id = '6f34592f-5e74-4a52-b03c-ed195d16fdbf';

-- 3. Reset Round 2 to scheduled, restore original opens_at (= Round 1 closes_at)
UPDATE public.auctions
SET status = 'scheduled', resolved_at = NULL, opens_at = '2026-05-06 22:00:00+00'
WHERE id = '603133c3-1bd4-41e3-8e29-5aadf225c9d1';

-- 4. Reset Round 3 to scheduled, restore original opens_at (= Round 2 closes_at)
UPDATE public.auctions
SET status = 'scheduled', resolved_at = NULL, opens_at = '2026-05-07 22:00:00+00'
WHERE id = '1619df21-f5e1-4f6d-863b-f71011b61338';
