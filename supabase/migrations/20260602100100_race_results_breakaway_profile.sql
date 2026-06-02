-- Spec A (A3/A4) — capture breakaway distance + stage profile for scoring (P2).
ALTER TABLE public.race_results
  ADD COLUMN IF NOT EXISTS breakaway_kms numeric,
  ADD COLUMN IF NOT EXISTS profile_icon  text;

COMMENT ON COLUMN public.race_results.breakaway_kms IS
  'Km the rider spent in the breakaway (PCS Stage.results breakaway_kms). NULL if unknown.';
COMMENT ON COLUMN public.race_results.profile_icon IS
  'PCS stage profile icon p0-p5 (p1 flat … p5 summit finish). NULL for non-stage results (e.g. GC).';
