-- Drop the new indexes + scope checks + race_slug columns.
DROP INDEX IF EXISTS public.idx_gt_tactic_activations_race_slug;
DROP INDEX IF EXISTS public.idx_gt_tactic_activations_by_slug;
DROP INDEX IF EXISTS public.idx_gt_role_team_race_slug;
DROP INDEX IF EXISTS public.idx_gt_squad_slot_tt_specialist_by_slug;
DROP INDEX IF EXISTS public.idx_gt_squad_slot_climber_by_slug;
DROP INDEX IF EXISTS public.idx_gt_squad_slot_sprinter_by_slug;
DROP INDEX IF EXISTS public.idx_gt_squad_slot_gc_leader_by_slug;
DROP INDEX IF EXISTS public.idx_gt_squad_active_rider_by_slug;

ALTER TABLE public.gt_tactic_activations DROP CONSTRAINT IF EXISTS gt_tactic_activations_scope_check;
ALTER TABLE public.gt_role_assignments  DROP CONSTRAINT IF EXISTS gt_role_assignments_scope_check;
ALTER TABLE public.gt_squad             DROP CONSTRAINT IF EXISTS gt_squad_scope_check;

ALTER TABLE public.gt_tactic_activations DROP COLUMN IF EXISTS race_slug;
ALTER TABLE public.gt_role_assignments  DROP COLUMN IF EXISTS race_slug;
ALTER TABLE public.gt_squad             DROP COLUMN IF EXISTS race_slug;

-- Note: we do NOT restore the strict phase_id IN (4,6,8) CHECK / NOT NULL
-- because intermediate migrations between P3b and the rollback target may have
-- inserted phase_id NULL rows. Operator must clean those up manually if needed.
