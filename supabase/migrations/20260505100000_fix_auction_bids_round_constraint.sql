-- Fix round constraint: old 3-round limit → 8 phases WT
ALTER TABLE public.auction_bids DROP CONSTRAINT IF EXISTS auction_bids_round_check;
ALTER TABLE public.auction_bids ADD CONSTRAINT auction_bids_round_check CHECK (round >= 1 AND round <= 8);
