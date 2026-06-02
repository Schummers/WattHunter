-- Spec A (A2) — allow 'youth' in the daily classification cache so the best-young
-- jersey can be scraped + scored daily alongside gc/points/kom (scoring in P2).
ALTER TABLE public.gt_daily_classifications
  DROP CONSTRAINT IF EXISTS gt_daily_classifications_classification_type_check;

ALTER TABLE public.gt_daily_classifications
  ADD CONSTRAINT gt_daily_classifications_classification_type_check
  CHECK (classification_type IN ('gc', 'points', 'kom', 'youth'));
