-- Rollback for 20260603120000_sponsors_two_value_bareme.sql
-- Restores the pre-Spec-C live values captured 2026-06-02.

-- T1-T3 (unchanged values, restated for completeness)
UPDATE public.sponsors SET bonus_gc = 5000,  bonus_stage = 2500,  bonus_one_day = 5000,
  gc_threshold = 25, stage_threshold = 10, one_day_threshold = 25 WHERE tier = 1;
UPDATE public.sponsors SET bonus_gc = 10000, bonus_stage = 5000,  bonus_one_day = 10000,
  gc_threshold = 20, stage_threshold = 10, one_day_threshold = 20 WHERE tier = 2;
UPDATE public.sponsors SET bonus_gc = 25000, bonus_stage = 10000, bonus_one_day = 20000,
  gc_threshold = 15, stage_threshold = 5,  one_day_threshold = 15 WHERE tier = 3;

-- T4 prior live values
UPDATE public.sponsors SET bonus_gc = 50000, bonus_stage = 20000, bonus_one_day = 25000,
  gc_threshold = 10, stage_threshold = 3,  one_day_threshold = 10 WHERE tier = 4;

-- T5 prior live values (per sponsor — they differed)
UPDATE public.sponsors SET bonus_gc = 25000, bonus_stage = 15000, bonus_one_day = 25000,
  gc_threshold = 5, stage_threshold = 1, one_day_threshold = 5,
  has_explicit_prestige = true,
  bonus_monument = 75000, bonus_grand_tour = 75000,
  monument_threshold = 3, grand_tour_threshold = 3 WHERE slug = 'visma';
UPDATE public.sponsors SET bonus_gc = 30000, bonus_stage = 15000, bonus_one_day = 30000,
  gc_threshold = 5, stage_threshold = 1, one_day_threshold = 5,
  has_explicit_prestige = true,
  bonus_monument = 50000, bonus_grand_tour = 50000,
  monument_threshold = 5, grand_tour_threshold = 5 WHERE slug = 'redbull-bora';
