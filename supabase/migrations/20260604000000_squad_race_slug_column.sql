-- Spec A (A9) — generalize gt_squad / gt_role_assignments / gt_tactic_activations
-- so they accept any stage-race race_slug (1-week stage races, not only GTs).
-- Additive + nullable: legacy phase_id rows continue to work; new code paths
-- prefer race_slug. Tour + Vuelta 2026 backfilled deterministically.

-- ---------------------------------------------------------------------------
-- 1. gt_squad — add race_slug, drop the strict phase_id CHECK, backfill, index
-- ---------------------------------------------------------------------------
ALTER TABLE public.gt_squad
  ADD COLUMN IF NOT EXISTS race_slug TEXT;

-- The original CHECK (phase_id IN (4,6,8)) is now too tight. Relax it to allow
-- legacy GT phase ids OR any non-null race_slug.
ALTER TABLE public.gt_squad
  DROP CONSTRAINT IF EXISTS gt_squad_phase_id_check;
ALTER TABLE public.gt_squad
  ALTER COLUMN phase_id DROP NOT NULL;
ALTER TABLE public.gt_squad
  ADD CONSTRAINT gt_squad_scope_check
    CHECK (
      phase_id IS NOT NULL
      OR race_slug IS NOT NULL
    );

-- Deterministic backfill for Tour + Vuelta only (Giro = forward-only, skipped).
UPDATE public.gt_squad
   SET race_slug = 'race/tour-de-france/' || year
 WHERE phase_id = 6 AND race_slug IS NULL;

UPDATE public.gt_squad
   SET race_slug = 'race/vuelta-a-espana/' || year
 WHERE phase_id = 8 AND race_slug IS NULL;

-- New partial unique indexes mirror the phase_id ones, scoped on race_slug.
-- (Each role's slot uniqueness — gc_leader, sprinter, climber, tt_specialist —
-- enforced once per (team_id, race_slug) for active rows.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_squad_active_rider_by_slug
  ON public.gt_squad(team_id, race_slug, rider_id)
  WHERE removed_at IS NULL AND race_slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_squad_slot_gc_leader_by_slug
  ON public.gt_squad(team_id, race_slug)
  WHERE role = 'gc_leader' AND removed_at IS NULL AND race_slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_squad_slot_sprinter_by_slug
  ON public.gt_squad(team_id, race_slug)
  WHERE role = 'sprinter' AND removed_at IS NULL AND race_slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_squad_slot_climber_by_slug
  ON public.gt_squad(team_id, race_slug)
  WHERE role = 'climber' AND removed_at IS NULL AND race_slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_squad_slot_tt_specialist_by_slug
  ON public.gt_squad(team_id, race_slug)
  WHERE role = 'tt_specialist' AND removed_at IS NULL AND race_slug IS NOT NULL;

COMMENT ON COLUMN public.gt_squad.race_slug IS
  'Race slug (e.g. race/paris-nice/2026, race/tour-de-france/2026). Preferred over phase_id going forward; phase_id retained for legacy Giro 2026.';

-- ---------------------------------------------------------------------------
-- 2. gt_role_assignments — add race_slug, relax phase_id CHECK, backfill
-- ---------------------------------------------------------------------------
ALTER TABLE public.gt_role_assignments
  ADD COLUMN IF NOT EXISTS race_slug TEXT;

ALTER TABLE public.gt_role_assignments
  DROP CONSTRAINT IF EXISTS gt_role_assignments_phase_id_check;
ALTER TABLE public.gt_role_assignments
  ALTER COLUMN phase_id DROP NOT NULL;
ALTER TABLE public.gt_role_assignments
  ADD CONSTRAINT gt_role_assignments_scope_check
    CHECK (
      phase_id IS NOT NULL
      OR race_slug IS NOT NULL
    );

UPDATE public.gt_role_assignments
   SET race_slug = 'race/tour-de-france/' || year
 WHERE phase_id = 6 AND race_slug IS NULL;

UPDATE public.gt_role_assignments
   SET race_slug = 'race/vuelta-a-espana/' || year
 WHERE phase_id = 8 AND race_slug IS NULL;

CREATE INDEX IF NOT EXISTS idx_gt_role_team_race_slug
  ON public.gt_role_assignments(team_id, race_slug, rider_id, applied_at DESC)
  WHERE race_slug IS NOT NULL;

COMMENT ON COLUMN public.gt_role_assignments.race_slug IS
  'Race slug. Preferred over phase_id going forward; phase_id retained for legacy Giro 2026.';

-- ---------------------------------------------------------------------------
-- 3. gt_tactic_activations — add race_slug, relax phase_id, backfill, index
-- ---------------------------------------------------------------------------
ALTER TABLE public.gt_tactic_activations
  ADD COLUMN IF NOT EXISTS race_slug TEXT;

-- The existing unique key (team_id, phase_id, year, stage_slug) still works
-- because stage_slug is per-stage. We add a parallel unique key for the
-- new race_slug-keyed callers so 1-week races can never accidentally collide.
ALTER TABLE public.gt_tactic_activations
  ALTER COLUMN phase_id DROP NOT NULL;
ALTER TABLE public.gt_tactic_activations
  ADD CONSTRAINT gt_tactic_activations_scope_check
    CHECK (
      phase_id IS NOT NULL
      OR race_slug IS NOT NULL
    );

UPDATE public.gt_tactic_activations
   SET race_slug = 'race/tour-de-france/' || year
 WHERE phase_id = 6 AND race_slug IS NULL;

UPDATE public.gt_tactic_activations
   SET race_slug = 'race/vuelta-a-espana/' || year
 WHERE phase_id = 8 AND race_slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_tactic_activations_by_slug
  ON public.gt_tactic_activations(team_id, race_slug, stage_slug)
  WHERE race_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gt_tactic_activations_race_slug
  ON public.gt_tactic_activations(team_id, race_slug)
  WHERE race_slug IS NOT NULL;

COMMENT ON COLUMN public.gt_tactic_activations.race_slug IS
  'Parent race slug for the activation (e.g. race/paris-nice/2026). Preferred over phase_id going forward.';
