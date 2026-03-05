-- Top 500 & Level Gating (2026-03-05-top500-level-gating-design.md)

-- 1. Add ever_in_top500 flag to riders
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS ever_in_top500 boolean NOT NULL DEFAULT false;

-- 2. Mark all existing riders with pcs_rank <= 500 as ever_in_top500
UPDATE public.riders SET ever_in_top500 = true WHERE pcs_rank IS NOT NULL AND pcs_rank <= 500;

-- 3. Mark all existing riders with pcs_points_1yr > 0 as ever_in_top500
-- (they were already verified from the PCS ranking)
UPDATE public.riders SET ever_in_top500 = true WHERE pcs_points_1yr > 0;
