-- Spec C: stable goal_key idempotency for sponsor_goal_completions.
-- Replaces the fragile numeric goal_index dedup with a single string-key guard.
--
-- Target invariant: every row carries a goal_key, goal_key is NOT NULL, and the
-- ONLY dedup mechanism is the unique index on (team_id, sponsor_id, goal_key, race_slug).
-- The legacy idx_goal_completions_dedup (goal_index-based) is dropped so the two
-- mechanisms can never disagree (which caused double-credit / silent skip at cutover).

ALTER TABLE public.sponsor_goal_completions ADD COLUMN IF NOT EXISTS goal_key text;

-- Deterministic backfill of historical (goal_key NULL) rows, keyed on
-- (sponsor slug, legacy goal_index) rather than goal_label. This disambiguates
-- the labels that collide across roles ("Win a stage" / "Win 2 stages" exist for
-- BOTH sprinter and stage_hunter in soudal/lidl-trek). The legacy goal_index is
-- the position in the old GT_GOALS list; the mapping mirrors the GT_GOALS ↔
-- SPONSOR_GOAL_SETS correspondence in services/pcs-sync/goal_evaluator.py.
WITH legacy_map(sponsor_slug, goal_index, new_key) AS (VALUES
  -- ineos: _GC_SET + _CLM_SET
  ('ineos',     0, 'gc_podium'),
  ('ineos',     1, 'gc_top5'),
  ('ineos',     2, 'gc_race_leader_jersey'),
  ('ineos',     3, 'gc_youth_jersey'),
  ('ineos',     4, 'clm_win_itt'),
  ('ineos',     5, 'clm_2_riders_itt_top10'),
  -- decathlon: _GC_SET + _SPRINT_SET
  ('decathlon', 0, 'gc_podium'),
  ('decathlon', 1, 'gc_top5'),
  ('decathlon', 2, 'gc_race_leader_jersey'),
  ('decathlon', 3, 'gc_youth_jersey'),
  ('decathlon', 4, 'sprint_win_stage'),
  ('decathlon', 5, 'sprint_points_jersey'),
  -- soudal: _SPRINT_SET + _SH_SET (idx 2 = sprinter "Win a stage", idx 5 = stage_hunter)
  ('soudal',    0, 'sprint_points_classification'),
  ('soudal',    1, 'sprint_win_2_stages'),
  ('soudal',    2, 'sprint_win_stage'),
  ('soudal',    3, 'sprint_points_jersey'),
  ('soudal',    4, 'legacy_two_riders_win_stage'),  -- no equivalent in new sets; synthetic key (never re-credited)
  ('soudal',    5, 'sh_win_stage'),
  -- lidl-trek: identical legacy layout to soudal
  ('lidl-trek', 0, 'sprint_points_classification'),
  ('lidl-trek', 1, 'sprint_win_2_stages'),
  ('lidl-trek', 2, 'sprint_win_stage'),
  ('lidl-trek', 3, 'sprint_points_jersey'),
  ('lidl-trek', 4, 'legacy_two_riders_win_stage'),
  ('lidl-trek', 5, 'sh_win_stage')
  -- visma / redbull-bora: new sponsors, never had GT_GOALS rows → nothing to backfill
)
UPDATE public.sponsor_goal_completions c
SET goal_key = m.new_key
FROM legacy_map m
JOIN public.sponsors s ON s.slug = m.sponsor_slug
WHERE c.sponsor_id = s.id
  AND c.goal_index = m.goal_index
  AND c.goal_key IS NULL;

-- Safety net: any still-NULL row (unexpected sponsor/index) gets a synthetic,
-- non-colliding key so the NOT NULL + unique invariants hold and it can never be
-- re-credited (the evaluator never emits a 'legacy_unmapped_*' key).
UPDATE public.sponsor_goal_completions
SET goal_key = 'legacy_unmapped_' || goal_index
WHERE goal_key IS NULL;

-- Enforce the invariant at the DB level.
ALTER TABLE public.sponsor_goal_completions ALTER COLUMN goal_key SET NOT NULL;

-- Drop the legacy goal_index dedup; goal_key is now the single source of truth.
DROP INDEX IF EXISTS public.idx_goal_completions_dedup;

-- Single idempotency guard (non-partial: goal_key is NOT NULL).
CREATE UNIQUE INDEX IF NOT EXISTS idx_goal_completions_key
  ON public.sponsor_goal_completions (team_id, sponsor_id, goal_key, race_slug);
