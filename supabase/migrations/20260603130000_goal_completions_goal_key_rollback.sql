-- Rollback for 20260603130000_goal_completions_goal_key.sql
DROP INDEX IF EXISTS public.idx_goal_completions_key;
ALTER TABLE public.sponsor_goal_completions DROP COLUMN IF EXISTS goal_key;
