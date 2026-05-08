-- GT Squad Builder V2: manual slot-based composition + soft-delete for swap history
-- Changes:
--   * gt_squad gets removed_at + role columns (denormalized from gt_role_assignments)
--   * Partial unique indexes for single-slot role caps (DB-enforced)
--   * Atomic SECURITY DEFINER RPCs for all GT squad mutations (race-condition safe)
--   * release_rider RPC updated to soft-delete GT squad membership

-- ---------------------------------------------------------------------------
-- 1. Add columns to gt_squad
-- ---------------------------------------------------------------------------
ALTER TABLE public.gt_squad
  ADD COLUMN removed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.gt_squad
  ADD COLUMN role TEXT NOT NULL DEFAULT 'domestique'
    CHECK (role IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique'));
-- ---------------------------------------------------------------------------
-- 2. Backfill role from latest gt_role_assignments (before dropping constraint)
-- ---------------------------------------------------------------------------
UPDATE public.gt_squad gs SET role = COALESCE(
  (SELECT gra.role FROM public.gt_role_assignments gra
   WHERE gra.team_id = gs.team_id
     AND gra.phase_id = gs.phase_id
     AND gra.year = gs.year
     AND gra.rider_id = gs.rider_id
   ORDER BY gra.applied_at DESC
   LIMIT 1),
  'domestique'
);
-- ---------------------------------------------------------------------------
-- 3. Safety check: backfill must not produce >1 holder for any single-slot role.
--    V1a never enforced caps in DB, so corrupted data could break index creation.
--    Abort the migration with a clear message if any group is over-cap.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_violations int;
BEGIN
  SELECT COUNT(*) INTO v_violations
  FROM (
    SELECT team_id, phase_id, year, role
    FROM public.gt_squad
    WHERE role IN ('gc_leader','sprinter','climber','tt_specialist')
      AND removed_at IS NULL
    GROUP BY team_id, phase_id, year, role
    HAVING COUNT(*) > 1
  ) over_cap;

  IF v_violations > 0 THEN
    RAISE EXCEPTION
      'gt_squad backfill produced % single-slot role groups with multiple active holders. Run a manual cleanup (soft-delete duplicates) before applying this migration.',
      v_violations;
  END IF;
END $$;
-- ---------------------------------------------------------------------------
-- 4. Replace unique constraint with partial unique indexes
-- ---------------------------------------------------------------------------
ALTER TABLE public.gt_squad
  DROP CONSTRAINT IF EXISTS gt_squad_team_id_phase_id_year_rider_id_key;
CREATE UNIQUE INDEX idx_gt_squad_active_rider
  ON public.gt_squad(team_id, phase_id, year, rider_id)
  WHERE removed_at IS NULL;
-- DB-enforced single-slot roles (max 1 active per team/phase/year)
CREATE UNIQUE INDEX idx_gt_squad_slot_gc_leader
  ON public.gt_squad(team_id, phase_id, year)
  WHERE role = 'gc_leader' AND removed_at IS NULL;
CREATE UNIQUE INDEX idx_gt_squad_slot_sprinter
  ON public.gt_squad(team_id, phase_id, year)
  WHERE role = 'sprinter' AND removed_at IS NULL;
CREATE UNIQUE INDEX idx_gt_squad_slot_climber
  ON public.gt_squad(team_id, phase_id, year)
  WHERE role = 'climber' AND removed_at IS NULL;
CREATE UNIQUE INDEX idx_gt_squad_slot_tt_specialist
  ON public.gt_squad(team_id, phase_id, year)
  WHERE role = 'tt_specialist' AND removed_at IS NULL;
-- stage_hunter (max 2) and domestique (max 2) caps enforced inside the RPCs
-- via SELECT ... FOR UPDATE on teams (serializes concurrent mutations per team).

-- ---------------------------------------------------------------------------
-- 5. Update release_rider RPC — soft-delete GT squad membership on release
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_rider(
  p_contract_id uuid,
  p_current_phase_id int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_contract record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT c.*, t.user_id AS team_user_id, t.league_id
  INTO v_contract
  FROM public.contracts c
  JOIN public.teams t ON t.id = c.team_id
  WHERE c.id = p_contract_id;

  IF v_contract IS NULL THEN
    RETURN jsonb_build_object('error', 'Contract not found');
  END IF;

  IF v_contract.team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  IF v_contract.status <> 'active' THEN
    RETURN jsonb_build_object('error', 'Contract is not active');
  END IF;

  IF v_contract.phase_recruited_id = p_current_phase_id THEN
    RETURN jsonb_build_object('error', 'Cannot release a rider recruited during the current phase');
  END IF;

  UPDATE public.contracts
  SET status = 'released', released_at = now()
  WHERE id = p_contract_id;

  DELETE FROM public.draft_bids
  WHERE team_id = v_contract.team_id
    AND rider_id = v_contract.rider_id;

  -- Soft-delete from active GT squad (any phase/year)
  UPDATE public.gt_squad
  SET removed_at = now()
  WHERE rider_id = v_contract.rider_id
    AND team_id = v_contract.team_id
    AND removed_at IS NULL;

  RETURN jsonb_build_object('ok', true);
END;
$$;
-- ---------------------------------------------------------------------------
-- 6. RPC: gt_add_to_squad — atomic add with cap + contract checks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gt_add_to_squad(
  p_team_id uuid,
  p_rider_id uuid,
  p_role text,
  p_phase_id int,
  p_year int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team_user_id uuid;
  v_team_league_id uuid;
  v_contract_exists boolean;
  v_already_in_squad boolean;
  v_role_count int;
  v_cap int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_role NOT IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique') THEN
    RETURN jsonb_build_object('error', 'Invalid role');
  END IF;

  IF p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id');
  END IF;

  -- Lock the team row to serialize all GT mutations for this team.
  SELECT user_id, league_id INTO v_team_user_id, v_team_league_id
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  -- Active contract required.
  SELECT EXISTS (
    SELECT 1 FROM public.contracts
    WHERE team_id = p_team_id AND rider_id = p_rider_id AND status = 'active'
  ) INTO v_contract_exists;

  IF NOT v_contract_exists THEN
    RETURN jsonb_build_object('error', 'Rider has no active contract with this team');
  END IF;

  -- Not already in active squad.
  SELECT EXISTS (
    SELECT 1 FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND rider_id = p_rider_id AND removed_at IS NULL
  ) INTO v_already_in_squad;

  IF v_already_in_squad THEN
    RETURN jsonb_build_object('error', 'Rider is already in the squad');
  END IF;

  -- Role cap check.
  v_cap := CASE p_role
    WHEN 'gc_leader' THEN 1
    WHEN 'sprinter' THEN 1
    WHEN 'climber' THEN 1
    WHEN 'tt_specialist' THEN 1
    WHEN 'stage_hunter' THEN 2
    WHEN 'domestique' THEN 2
  END;

  SELECT COUNT(*) INTO v_role_count
  FROM public.gt_squad
  WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
    AND role = p_role AND removed_at IS NULL;

  IF v_role_count >= v_cap THEN
    RETURN jsonb_build_object('error', format('Role %s is at capacity (%s)', p_role, v_cap));
  END IF;

  INSERT INTO public.gt_squad (team_id, phase_id, year, rider_id, role)
  VALUES (p_team_id, p_phase_id, p_year, p_rider_id, p_role);

  INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role)
  VALUES (p_team_id, p_phase_id, p_year, p_rider_id, p_role);

  RETURN jsonb_build_object('ok', true);
END;
$$;
-- ---------------------------------------------------------------------------
-- 7. RPC: gt_remove_from_squad — atomic soft-delete
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gt_remove_from_squad(
  p_team_id uuid,
  p_rider_id uuid,
  p_phase_id int,
  p_year int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team_user_id uuid;
  v_squad_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id');
  END IF;

  SELECT user_id INTO v_team_user_id
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  SELECT id INTO v_squad_id
  FROM public.gt_squad
  WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
    AND rider_id = p_rider_id AND removed_at IS NULL;

  IF v_squad_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Rider not in squad');
  END IF;

  UPDATE public.gt_squad SET removed_at = now() WHERE id = v_squad_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
-- ---------------------------------------------------------------------------
-- 8. RPC: gt_swap_slot — atomic soft-delete + insert (new rider inherits role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gt_swap_slot(
  p_team_id uuid,
  p_old_rider_id uuid,
  p_new_rider_id uuid,
  p_phase_id int,
  p_year int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team_user_id uuid;
  v_old_squad_id uuid;
  v_inherited_role text;
  v_contract_exists boolean;
  v_already_in_squad boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id');
  END IF;

  SELECT user_id INTO v_team_user_id
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  SELECT id, role INTO v_old_squad_id, v_inherited_role
  FROM public.gt_squad
  WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
    AND rider_id = p_old_rider_id AND removed_at IS NULL;

  IF v_old_squad_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Old rider not in squad');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contracts
    WHERE team_id = p_team_id AND rider_id = p_new_rider_id AND status = 'active'
  ) INTO v_contract_exists;

  IF NOT v_contract_exists THEN
    RETURN jsonb_build_object('error', 'New rider has no active contract with this team');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND rider_id = p_new_rider_id AND removed_at IS NULL
  ) INTO v_already_in_squad;

  IF v_already_in_squad THEN
    RETURN jsonb_build_object('error', 'New rider is already in the squad');
  END IF;

  UPDATE public.gt_squad SET removed_at = now() WHERE id = v_old_squad_id;

  INSERT INTO public.gt_squad (team_id, phase_id, year, rider_id, role)
  VALUES (p_team_id, p_phase_id, p_year, p_new_rider_id, v_inherited_role);

  INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role)
  VALUES (p_team_id, p_phase_id, p_year, p_new_rider_id, v_inherited_role);

  RETURN jsonb_build_object('ok', true);
END;
$$;
-- ---------------------------------------------------------------------------
-- 9. RPC: gt_assign_role — atomic role change with deterministic demotion
--    If the target role is at capacity, demotes the OLDEST holder (by created_at)
--    to domestique, then assigns the new role.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gt_assign_role(
  p_team_id uuid,
  p_rider_id uuid,
  p_role text,
  p_phase_id int,
  p_year int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team_user_id uuid;
  v_squad_id uuid;
  v_cap int;
  v_demote record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_role NOT IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique') THEN
    RETURN jsonb_build_object('error', 'Invalid role');
  END IF;

  IF p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id');
  END IF;

  SELECT user_id INTO v_team_user_id
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  SELECT id INTO v_squad_id
  FROM public.gt_squad
  WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
    AND rider_id = p_rider_id AND removed_at IS NULL;

  IF v_squad_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Rider not in squad');
  END IF;

  v_cap := CASE p_role
    WHEN 'gc_leader' THEN 1
    WHEN 'sprinter' THEN 1
    WHEN 'climber' THEN 1
    WHEN 'tt_specialist' THEN 1
    WHEN 'stage_hunter' THEN 2
    WHEN 'domestique' THEN 2
  END;

  -- Demote oldest current holder if at cap (excluding the target rider).
  -- ORDER BY created_at ASC ensures deterministic demotion (oldest first).
  IF (
    SELECT COUNT(*) FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND role = p_role AND removed_at IS NULL AND rider_id <> p_rider_id
  ) >= v_cap THEN
    SELECT id, rider_id INTO v_demote
    FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND role = p_role AND removed_at IS NULL AND rider_id <> p_rider_id
    ORDER BY created_at ASC
    LIMIT 1;

    UPDATE public.gt_squad SET role = 'domestique' WHERE id = v_demote.id;

    INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role)
    VALUES (p_team_id, p_phase_id, p_year, v_demote.rider_id, 'domestique');
  END IF;

  UPDATE public.gt_squad SET role = p_role WHERE id = v_squad_id;

  INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role)
  VALUES (p_team_id, p_phase_id, p_year, p_rider_id, p_role);

  RETURN jsonb_build_object('ok', true);
END;
$$;
