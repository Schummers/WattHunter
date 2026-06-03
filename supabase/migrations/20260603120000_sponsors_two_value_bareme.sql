-- Spec C — 2-value barème. Store only the A (1-week) value; B (GT/Monument) = 2×A
-- is applied at runtime in sponsor_bonus.py. T1-T3 reaffirmed (live already matches),
-- T4 reduced, T5 = T4 with prestige folded into runtime ×2. T6 (UAE) deferred — untouched.

-- T1-T3: reaffirm target A values + thresholds (idempotent)
UPDATE public.sponsors SET bonus_gc = 5000,  bonus_stage = 2500,  bonus_one_day = 5000,
  gc_threshold = 25, stage_threshold = 10, one_day_threshold = 25 WHERE tier = 1;
UPDATE public.sponsors SET bonus_gc = 10000, bonus_stage = 5000,  bonus_one_day = 10000,
  gc_threshold = 20, stage_threshold = 10, one_day_threshold = 20 WHERE tier = 2;
UPDATE public.sponsors SET bonus_gc = 25000, bonus_stage = 10000, bonus_one_day = 20000,
  gc_threshold = 15, stage_threshold = 5,  one_day_threshold = 15 WHERE tier = 3;

-- T4: reduced base (GC 50k→10k, Stage 20k→5k, One-day 25k→10k); thresholds unchanged
UPDATE public.sponsors SET bonus_gc = 10000, bonus_stage = 5000,  bonus_one_day = 10000,
  gc_threshold = 10, stage_threshold = 3,  one_day_threshold = 10 WHERE tier = 4;

-- T5: identical to T4; drop explicit prestige (runtime ×2 replaces it)
UPDATE public.sponsors SET bonus_gc = 10000, bonus_stage = 5000,  bonus_one_day = 10000,
  gc_threshold = 10, stage_threshold = 3,  one_day_threshold = 10,
  has_explicit_prestige = false,
  bonus_monument = NULL, bonus_grand_tour = NULL,
  monument_threshold = NULL, grand_tour_threshold = NULL WHERE tier = 5;

-- T6 (UAE): intentionally untouched (deferred).
