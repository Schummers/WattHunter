-- Migration: Flat base bonuses for T1-T4 sponsors
-- Spec: docs/superpowers/specs/2026-05-03-sponsor-gt-goals-design.md (Section 2)
-- Removes orientation-specific bonus differences within tiers.
-- T5/T6 unchanged (out of scope).

-- T1: Lotto — Top 25 GC 5K, Top 10 Stage 2.5K, Top 25 One-Day 5K
UPDATE public.sponsors SET
  bonus_gc = 5000, gc_threshold = 25,
  bonus_stage = 2500, stage_threshold = 10,
  bonus_one_day = 5000, one_day_threshold = 25
WHERE tier = 1;

-- T2: Astana — Top 20 GC 10K, Top 10 Stage 5K, Top 20 One-Day 10K
UPDATE public.sponsors SET
  bonus_gc = 10000, gc_threshold = 20,
  bonus_stage = 5000, stage_threshold = 10,
  bonus_one_day = 10000, one_day_threshold = 20
WHERE tier = 2;

-- T3: Groupama, Movistar, Alpecin, Uno-X — Top 15 GC 25K, Top 5 Stage 10K, Top 15 One-Day 20K
UPDATE public.sponsors SET
  bonus_gc = 25000, gc_threshold = 15,
  bonus_stage = 10000, stage_threshold = 5,
  bonus_one_day = 20000, one_day_threshold = 15
WHERE tier = 3;

-- T4: Ineos, Decathlon, Soudal, Lidl-Trek — Top 10 GC 50K, Podium Stage 20K, Top 10 One-Day 25K
UPDATE public.sponsors SET
  bonus_gc = 50000, gc_threshold = 10,
  bonus_stage = 20000, stage_threshold = 3,
  bonus_one_day = 25000, one_day_threshold = 10
WHERE tier = 4;
