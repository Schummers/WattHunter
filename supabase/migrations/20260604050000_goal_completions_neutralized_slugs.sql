-- No-cumul rule (GAME_RULES.md §17): record which base-bonus race_slugs a
-- completed one-time goal consumes, so process_race_bonuses can skip emitting
-- those base bonuses (no double-pay: goal OR base bonus, never both).
--
-- Written by goal_evaluator.evaluate_sponsor_goals at completion time:
--   gc_podium / gc_top5 → ['{parent}/gc']
--   sprint/sh win_stage  → [winning stage_slug]
--   sprint/sh win_2_stages → [all counted stage_slugs]
--   classification / wear-jersey goals → '{}' (no single-race base bonus)
--
-- Default '{}' so historical completions (Giro, already reconciled manually) are
-- treated as neutralizing nothing — no retroactive change.

ALTER TABLE public.sponsor_goal_completions
  ADD COLUMN IF NOT EXISTS neutralized_stage_slugs text[] NOT NULL DEFAULT '{}';
