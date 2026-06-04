-- Rollback for 20260604050000_goal_completions_neutralized_slugs.
-- Lives in _rollback/ as .down.sql so `supabase db reset` does not replay it as
-- a forward migration (version-collision gotcha).

ALTER TABLE public.sponsor_goal_completions
  DROP COLUMN IF EXISTS neutralized_stage_slugs;
