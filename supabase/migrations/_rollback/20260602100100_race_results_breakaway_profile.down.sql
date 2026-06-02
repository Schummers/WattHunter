ALTER TABLE public.race_results
  DROP COLUMN IF EXISTS breakaway_kms,
  DROP COLUMN IF EXISTS profile_icon;
