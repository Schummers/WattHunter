-- Spec B (B1/B2/B3) — underdog role + dynamic, race_slug-aware squad cap.
-- (a) Relax role CHECKs on gt_squad + gt_role_assignments to accept 'underdog'.
-- (b) Recreate enforce_gt_squad_cap() as race_slug-aware + dynamic cap (8 or 10).
-- (c) Recreate v2 gt_add_to_squad + gt_assign_role with underdog allow-list,
--     per-role cap (WHEN 'underdog' THEN 2), and eligibility gate.

-- ---------------------------------------------------------------------------
-- Part 1 — relax both role CHECKs
-- ---------------------------------------------------------------------------
ALTER TABLE public.gt_squad DROP CONSTRAINT IF EXISTS gt_squad_role_check;
ALTER TABLE public.gt_squad ADD CONSTRAINT gt_squad_role_check
  CHECK (role IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique','underdog'));

ALTER TABLE public.gt_role_assignments DROP CONSTRAINT IF EXISTS gt_role_assignments_role_check;
ALTER TABLE public.gt_role_assignments ADD CONSTRAINT gt_role_assignments_role_check
  CHECK (role IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique','underdog'));

-- ---------------------------------------------------------------------------
-- Part 2 — recreate enforce_gt_squad_cap: race_slug-aware + dynamic cap
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_gt_squad_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_size INT;
  v_cap INT;
BEGIN
  SELECT CASE WHEN underdog_eligible THEN 10 ELSE 8 END
    INTO v_cap FROM public.teams WHERE id = NEW.team_id;
  v_cap := COALESCE(v_cap, 8);

  IF NEW.race_slug IS NOT NULL THEN
    SELECT COUNT(*) INTO current_size FROM public.gt_squad
    WHERE team_id = NEW.team_id AND race_slug = NEW.race_slug AND removed_at IS NULL;
  ELSE
    SELECT COUNT(*) INTO current_size FROM public.gt_squad
    WHERE team_id = NEW.team_id AND phase_id = NEW.phase_id AND year = NEW.year
      AND removed_at IS NULL;
  END IF;

  IF current_size >= v_cap THEN
    RAISE EXCEPTION 'Squad already at max (% riders)', v_cap USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Part 3 — recreate v2 RPCs from 20260604000300 + apply 3 diffs (A/B/C)
-- ---------------------------------------------------------------------------

-- 3a. gt_add_to_squad v2 + underdog
CREATE OR REPLACE FUNCTION public.gt_add_to_squad(
  p_team_id   uuid,
  p_rider_id  uuid,
  p_role      text,
  p_phase_id  int,
  p_year      int,
  p_race_slug text DEFAULT NULL  -- v2 (Spec A A9)
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_team_user_id     uuid;
  v_team_eligible    boolean;  -- Diff C: underdog eligibility flag
  v_contract_exists  boolean;
  v_already_in_squad boolean;
  v_role_count       int;
  v_cap              int;
  v_use_slug         boolean := p_race_slug IS NOT NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Diff A: 'underdog' added to allow-list
  IF p_role NOT IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique','underdog') THEN
    RETURN jsonb_build_object('error', 'Invalid role');
  END IF;

  -- Validate scope: either a race_slug or a legacy GT phase id must be provided.
  IF NOT v_use_slug AND p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id (and no race_slug provided)');
  END IF;

  -- Diff C: also read underdog_eligible
  SELECT user_id, underdog_eligible INTO v_team_user_id, v_team_eligible
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  -- Diff C: eligibility gate (immediately after "Not team owner" check)
  IF p_role = 'underdog' AND NOT COALESCE(v_team_eligible, false) THEN
    RETURN jsonb_build_object('error', 'Underdog role is only available to underdog-eligible teams');
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

  -- Diff B: WHEN 'underdog' THEN 2 added to the CASE
  v_cap := CASE p_role
    WHEN 'gc_leader'     THEN 1
    WHEN 'sprinter'      THEN 1
    WHEN 'climber'       THEN 1
    WHEN 'tt_specialist' THEN 1
    WHEN 'stage_hunter'  THEN 2
    WHEN 'domestique'    THEN 2
    WHEN 'underdog'      THEN 2
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

-- 3b. gt_assign_role v2 + underdog
CREATE OR REPLACE FUNCTION public.gt_assign_role(
  p_team_id   uuid,
  p_rider_id  uuid,
  p_role      text,
  p_phase_id  int,
  p_year      int,
  p_race_slug text DEFAULT NULL  -- v2 (Spec A A9)
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_team_user_id uuid;
  v_team_eligible boolean;  -- Diff C: underdog eligibility flag
  v_squad_id     uuid;
  v_cap          int;
  v_demote       record;
  v_use_slug     boolean := p_race_slug IS NOT NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Diff A: 'underdog' added to allow-list
  IF p_role NOT IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique','underdog') THEN
    RETURN jsonb_build_object('error', 'Invalid role');
  END IF;

  IF NOT v_use_slug AND p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id (and no race_slug provided)');
  END IF;

  -- Diff C: also read underdog_eligible
  SELECT user_id, underdog_eligible INTO v_team_user_id, v_team_eligible
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  -- Diff C: eligibility gate (immediately after "Not team owner" check)
  IF p_role = 'underdog' AND NOT COALESCE(v_team_eligible, false) THEN
    RETURN jsonb_build_object('error', 'Underdog role is only available to underdog-eligible teams');
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

  -- Diff B: WHEN 'underdog' THEN 2 added to the CASE
  v_cap := CASE p_role
    WHEN 'gc_leader'     THEN 1
    WHEN 'sprinter'      THEN 1
    WHEN 'climber'       THEN 1
    WHEN 'tt_specialist' THEN 1
    WHEN 'stage_hunter'  THEN 2
    WHEN 'domestique'    THEN 2
    WHEN 'underdog'      THEN 2
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
