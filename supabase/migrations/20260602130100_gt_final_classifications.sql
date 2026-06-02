-- Spec A (A2) — dedicated store for final GT secondary jerseys (Points/KOM/Youth).
-- Kept OUT of race_results so it never pollutes sponsor_bonus / goal_evaluator / UI,
-- which treat any non-gc race_results stage as a stage result. Read only by scoring's
-- final-secondary pass. Rank-only (PCS assigns no points to these jerseys).
CREATE TABLE IF NOT EXISTS public.gt_final_classifications (
  race_slug            text NOT NULL,            -- 'race/giro-d-italia/2026/points' | '/kom' | '/youth'
  classification_type  text NOT NULL CHECK (classification_type IN ('points', 'kom', 'youth')),
  rider_id             uuid NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  rank                 int  NOT NULL,
  race_date            date,
  created_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (race_slug, rider_id)
);

ALTER TABLE public.gt_final_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read gt_final_classifications"
  ON public.gt_final_classifications FOR SELECT USING (true);
