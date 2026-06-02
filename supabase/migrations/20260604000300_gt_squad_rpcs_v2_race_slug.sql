-- Spec A (A9) — gt_squad RPCs v2: accept race_slug for 1-week stage races.
-- Backwards-compatible: callers that pass NULL keep the old phase_id-only behavior.

-- Postgres resolves functions by full type list. Without dropping the v1
-- signatures first, the CREATE OR REPLACE statements below would create NEW
-- 6-arg functions alongside the existing 5-arg ones (or 4-arg for gt_remove),
-- leaving two coexisting versions and ambiguous resolution for callers that
-- rely on default arguments. Drop the v1 signatures explicitly.
DROP FUNCTION IF EXISTS public.gt_add_to_squad(uuid, uuid, text, int, int);
DROP FUNCTION IF EXISTS public.gt_remove_from_squad(uuid, uuid, int, int);
DROP FUNCTION IF EXISTS public.gt_swap_slot(uuid, uuid, uuid, int, int);
DROP FUNCTION IF EXISTS public.gt_assign_role(uuid, uuid, text, int, int);

-- ---------------------------------------------------------------------------
-- 1. gt_add_to_squad v2
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gt_add_to_squad(
  p_team_id   uuid,
  p_rider_id  uuid,
  p_role      text,
  p_phase_id  int,
  p_year      int,
  p_race_slug text DEFAULT NULL  -- NEW in v2 (Spec A A9)
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_team_user_id     uuid;
  v_contract_exists  boolean;
  v_already_in_squad boolean;
  v_role_count       int;
  v_cap              int;
  v_use_slug         boolean := p_race_slug IS NOT NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_role NOT IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique') THEN
    RETURN jsonb_build_object('error', 'Invalid role');
  END IF;

  -- Validate scope: either a race_slug or a legacy GT phase id must be provided.
  IF NOT v_use_slug AND p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id (and no race_slug provided)');
  END IF;

  SELECT user_id INTO v_team_user_id
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contracts
    WHERE team_id = p_team_id AND rider_id = p_rider_id AND status = 'active'
  ) INTO v_contract_exists;

  IF NOT v_contract_exists THEN
    RETURN jsonb_build_object('error', 'Rider has no active contract with this team');
  END IF;

  -- "Already in squad" check (scope-aware)
  IF v_use_slug THEN
    SELECT EXISTS (
      SELECT 1 FROM public.gt_squad
      WHERE team_id = p_team_id AND race_slug = p_race_slug
        AND rider_id = p_rider_id AND removed_at IS NULL
    ) INTO v_already_in_squad;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.gt_squad
      WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
        AND rider_id = p_rider_id AND removed_at IS NULL
    ) INTO v_already_in_squad;
  END IF;

  IF v_already_in_squad THEN
    RETURN jsonb_build_object('error', 'Rider is already in the squad');
  END IF;

  v_cap := CASE p_role
    WHEN 'gc_leader'     THEN 1
    WHEN 'sprinter'      THEN 1
    WHEN 'climber'       THEN 1
    WHEN 'tt_specialist' THEN 1
    WHEN 'stage_hunter'  THEN 2
    WHEN 'domestique'    THEN 2
  END;

  IF v_use_slug THEN
    SELECT COUNT(*) INTO v_role_count
    FROM public.gt_squad
    WHERE team_id = p_team_id AND race_slug = p_race_slug
      AND role = p_role AND removed_at IS NULL;
  ELSE
    SELECT COUNT(*) INTO v_role_count
    FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND role = p_role AND removed_at IS NULL;
  END IF;

  IF v_role_count >= v_cap THEN
    RETURN jsonb_build_object('error', format('Role %s is at capacity (%s)', p_role, v_cap));
  END IF;

  INSERT INTO public.gt_squad (team_id, phase_id, year, rider_id, role, race_slug)
  VALUES (p_team_id, p_phase_id, p_year, p_rider_id, p_role, p_race_slug);

  INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role, race_slug)
  VALUES (p_team_id, p_phase_id, p_year, p_rider_id, p_role, p_race_slug);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. gt_remove_from_squad v2
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gt_remove_from_squad(
  p_team_id   uuid,
  p_rider_id  uuid,
  p_phase_id  int,
  p_year      int,
  p_race_slug text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_team_user_id uuid;
  v_squad_id     uuid;
  v_use_slug     boolean := p_race_slug IS NOT NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF NOT v_use_slug AND p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id (and no race_slug provided)');
  END IF;

  SELECT user_id INTO v_team_user_id
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  IF v_use_slug THEN
    SELECT id INTO v_squad_id
    FROM public.gt_squad
    WHERE team_id = p_team_id AND race_slug = p_race_slug
      AND rider_id = p_rider_id AND removed_at IS NULL;
  ELSE
    SELECT id INTO v_squad_id
    FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND rider_id = p_rider_id AND removed_at IS NULL;
  END IF;

  IF v_squad_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Rider not in squad');
  END IF;

  UPDATE public.gt_squad SET removed_at = now() WHERE id = v_squad_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. gt_swap_slot v2
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gt_swap_slot(
  p_team_id      uuid,
  p_old_rider_id uuid,
  p_new_rider_id uuid,
  p_phase_id     int,
  p_year         int,
  p_race_slug    text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_team_user_id     uuid;
  v_old_squad_id     uuid;
  v_inherited_role   text;
  v_contract_exists  boolean;
  v_already_in_squad boolean;
  v_use_slug         boolean := p_race_slug IS NOT NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF NOT v_use_slug AND p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id (and no race_slug provided)');
  END IF;

  SELECT user_id INTO v_team_user_id
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  IF v_use_slug THEN
    SELECT id, role INTO v_old_squad_id, v_inherited_role
    FROM public.gt_squad
    WHERE team_id = p_team_id AND race_slug = p_race_slug
      AND rider_id = p_old_rider_id AND removed_at IS NULL;
  ELSE
    SELECT id, role INTO v_old_squad_id, v_inherited_role
    FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND rider_id = p_old_rider_id AND removed_at IS NULL;
  END IF;

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

  IF v_use_slug THEN
    SELECT EXISTS (
      SELECT 1 FROM public.gt_squad
      WHERE team_id = p_team_id AND race_slug = p_race_slug
        AND rider_id = p_new_rider_id AND removed_at IS NULL
    ) INTO v_already_in_squad;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.gt_squad
      WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
        AND rider_id = p_new_rider_id AND removed_at IS NULL
    ) INTO v_already_in_squad;
  END IF;

  IF v_already_in_squad THEN
    RETURN jsonb_build_object('error', 'New rider is already in the squad');
  END IF;

  UPDATE public.gt_squad SET removed_at = now() WHERE id = v_old_squad_id;

  INSERT INTO public.gt_squad (team_id, phase_id, year, rider_id, role, race_slug)
  VALUES (p_team_id, p_phase_id, p_year, p_new_rider_id, v_inherited_role, p_race_slug);

  INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role, race_slug)
  VALUES (p_team_id, p_phase_id, p_year, p_new_rider_id, v_inherited_role, p_race_slug);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. gt_assign_role v2
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gt_assign_role(
  p_team_id   uuid,
  p_rider_id  uuid,
  p_role      text,
  p_phase_id  int,
  p_year      int,
  p_race_slug text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_team_user_id uuid;
  v_squad_id     uuid;
  v_cap          int;
  v_demote       record;
  v_use_slug     boolean := p_race_slug IS NOT NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_role NOT IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique') THEN
    RETURN jsonb_build_object('error', 'Invalid role');
  END IF;

  IF NOT v_use_slug AND p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id (and no race_slug provided)');
  END IF;

  SELECT user_id INTO v_team_user_id
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  IF v_use_slug THEN
    SELECT id INTO v_squad_id
    FROM public.gt_squad
    WHERE team_id = p_team_id AND race_slug = p_race_slug
      AND rider_id = p_rider_id AND removed_at IS NULL;
  ELSE
    SELECT id INTO v_squad_id
    FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND rider_id = p_rider_id AND removed_at IS NULL;
  END IF;

  IF v_squad_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Rider not in squad');
  END IF;

  v_cap := CASE p_role
    WHEN 'gc_leader'     THEN 1
    WHEN 'sprinter'      THEN 1
    WHEN 'climber'       THEN 1
    WHEN 'tt_specialist' THEN 1
    WHEN 'stage_hunter'  THEN 2
    WHEN 'domestique'    THEN 2
  END;

  -- Demote oldest current holder if at cap (excluding the target rider).
  IF v_use_slug THEN
    IF (
      SELECT COUNT(*) FROM public.gt_squad
      WHERE team_id = p_team_id AND race_slug = p_race_slug
        AND role = p_role AND removed_at IS NULL AND rider_id <> p_rider_id
    ) >= v_cap THEN
      SELECT id, rider_id INTO v_demote
      FROM public.gt_squad
      WHERE team_id = p_team_id AND race_slug = p_race_slug
        AND role = p_role AND removed_at IS NULL AND rider_id <> p_rider_id
      ORDER BY created_at ASC
      LIMIT 1;

      UPDATE public.gt_squad SET role = 'domestique' WHERE id = v_demote.id;

      INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role, race_slug)
      VALUES (p_team_id, p_phase_id, p_year, v_demote.rider_id, 'domestique', p_race_slug);
    END IF;
  ELSE
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
  END IF;

  UPDATE public.gt_squad SET role = p_role WHERE id = v_squad_id;

  INSERT INTO public.gt_role_assignments (team_id, phase_id, year, rider_id, role, race_slug)
  VALUES (p_team_id, p_phase_id, p_year, p_rider_id, p_role, p_race_slug);

  RETURN jsonb_build_object('ok', true);
END;
$$;
