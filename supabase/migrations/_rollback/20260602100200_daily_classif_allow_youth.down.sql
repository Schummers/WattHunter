-- Rollback: remove 'youth' first (will fail loudly if youth rows exist — clean them first).
DELETE FROM public.gt_daily_classifications WHERE classification_type = 'youth';

ALTER TABLE public.gt_daily_classifications
  DROP CONSTRAINT IF EXISTS gt_daily_classifications_classification_type_check;

ALTER TABLE public.gt_daily_classifications
  ADD CONSTRAINT gt_daily_classifications_classification_type_check
  CHECK (classification_type IN ('gc', 'points', 'kom'));
