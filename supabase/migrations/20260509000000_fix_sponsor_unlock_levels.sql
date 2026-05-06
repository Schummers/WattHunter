-- Fix sponsor tier unlock levels to match spec:
-- T4 (750k): unlock_level 5 → 4 (unlocks at Level 4, not 5)
-- T5 (1M):   unlock_level 7 → 6 (unlocks at Level 6, not 7)
UPDATE public.sponsors SET unlock_level = 4 WHERE tier = 4;
UPDATE public.sponsors SET unlock_level = 6 WHERE tier = 5;
