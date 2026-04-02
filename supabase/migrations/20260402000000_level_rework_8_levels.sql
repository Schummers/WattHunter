-- Level system rework: 10 levels → 8 levels, pool expansion 500 → 600
-- Aligned with 8 WT calendar phases
-- NOTE: ever_in_top500 column name kept for compatibility (semantically covers top 600)

-- 1. Recalculate all team levels using new 8-level XP thresholds
-- Old thresholds: [0, 50, 150, 300, 500, 700, 1000, 1400, 1900, 2500]
-- New thresholds: [0, 25, 150, 350, 600, 900, 1500, 2000]
UPDATE public.teams SET level = CASE
  WHEN cumulative_xp >= 2000 THEN 8
  WHEN cumulative_xp >= 1500 THEN 7
  WHEN cumulative_xp >= 900  THEN 6
  WHEN cumulative_xp >= 600  THEN 5
  WHEN cumulative_xp >= 350  THEN 4
  WHEN cumulative_xp >= 150  THEN 3
  WHEN cumulative_xp >= 25   THEN 2
  ELSE 1
END;

-- 2. Drop ALL existing check constraints on teams.level (name may vary by PG version)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.teams'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%level%'
  LOOP
    EXECUTE format('ALTER TABLE public.teams DROP CONSTRAINT %I', r.conname);
  END LOOP;
END$$;
ALTER TABLE public.teams ADD CONSTRAINT teams_level_check CHECK (level BETWEEN 1 AND 8);

-- 3. Drop ALL existing check constraints on sponsors.unlock_level
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.sponsors'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%unlock_level%'
  LOOP
    EXECUTE format('ALTER TABLE public.sponsors DROP CONSTRAINT %I', r.conname);
  END LOOP;
END$$;
ALTER TABLE public.sponsors ADD CONSTRAINT sponsors_unlock_level_check CHECK (unlock_level BETWEEN 1 AND 8);

-- 4. Update sponsor unlock_levels to match new level system
-- T3 sponsors (Decathlon, SQS, Ineos, Bora, Trek): 5 → 4 (Giro)
UPDATE public.sponsors SET unlock_level = 4 WHERE tier = 3;
-- T4 sponsors (Lidl, Red Bull, Visma): 7 → 6 (Tour de France)
UPDATE public.sponsors SET unlock_level = 6 WHERE tier = 4;

-- 5. Expand rider pool: mark riders ranked 501-600 as eligible
UPDATE public.riders SET ever_in_top500 = true WHERE pcs_rank <= 600 AND pcs_rank > 0;
