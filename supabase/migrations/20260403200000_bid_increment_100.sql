-- Change bid increment from 500 to 100
-- Affects: draft_bids, auction_bids

-- draft_bids: drop old constraint, add new one
ALTER TABLE public.draft_bids DROP CONSTRAINT IF EXISTS draft_bids_amount_check;
ALTER TABLE public.draft_bids
  ADD CONSTRAINT draft_bids_amount_check CHECK (amount >= 5000 AND amount % 100 = 0);

-- auction_bids: update constraint if exists
ALTER TABLE public.auction_bids DROP CONSTRAINT IF EXISTS auction_bids_amount_check;
ALTER TABLE public.auction_bids
  ADD CONSTRAINT auction_bids_amount_check CHECK (amount >= 5000 AND amount % 100 = 0);
