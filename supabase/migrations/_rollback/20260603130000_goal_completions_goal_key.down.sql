-- Rollback for 20260603130000_goal_completions_goal_key.sql
DROP INDEX IF EXISTS public.idx_goal_completions_key;
-- Restore the legacy goal_index dedup index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_goal_completions_dedup
  ON public.sponsor_goal_completions (team_id, sponsor_id, goal_index, race_slug);
ALTER TABLE public.sponsor_goal_completions ALTER COLUMN goal_key DROP NOT NULL;
ALTER TABLE public.sponsor_goal_completions DROP COLUMN IF EXISTS goal_key;
