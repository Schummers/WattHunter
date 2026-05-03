ALTER TABLE public.auction_bids DROP CONSTRAINT IF EXISTS auction_bids_round_check;
ALTER TABLE public.auction_bids ADD CONSTRAINT auction_bids_round_check CHECK (round >= 1 AND round <= 3);
