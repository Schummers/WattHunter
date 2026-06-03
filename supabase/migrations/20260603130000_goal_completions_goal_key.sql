-- Spec C: add stable goal_key column to sponsor_goal_completions.
-- Replaces fragile numeric goal_index idempotency with a unique string key.
-- Idempotency guard: (team_id, sponsor_id, goal_key, race_slug) UNIQUE WHERE goal_key IS NOT NULL.

ALTER TABLE public.sponsor_goal_completions ADD COLUMN IF NOT EXISTS goal_key text;

-- Backfill known historical (Giro 2026) rows so re-runs stay idempotent under the new key.
UPDATE public.sponsor_goal_completions SET goal_key = 'sprint_win_stage'
  WHERE goal_key IS NULL AND goal_label = 'Win a stage';
UPDATE public.sponsor_goal_completions SET goal_key = 'clm_win_itt'
  WHERE goal_key IS NULL AND goal_label = 'Win an ITT';
UPDATE public.sponsor_goal_completions SET goal_key = 'sprint_points_jersey'
  WHERE goal_key IS NULL AND goal_label IN ('Wear ciclamino', 'Wear maglia ciclamino');

-- Idempotency guard for future evaluations.
CREATE UNIQUE INDEX IF NOT EXISTS idx_goal_completions_key
  ON public.sponsor_goal_completions (team_id, sponsor_id, goal_key, race_slug)
  WHERE goal_key IS NOT NULL;
