-- Spec B (post-review hotfix) — enforce pcs_rank > 100 for the underdog role
-- across the 3 entry points: gt_add_to_squad, gt_assign_role, flag_underdog_contract.
-- Code review findings #2 / #3 / #4 (silent waste of slot + salary-discount bypass via role-swap).
--
-- Strategy: a single SQL helper `is_underdog_rank(rider_id)` is the single source
-- of truth for the rank predicate, called from both RPCs and the trigger.
-- NULL pcs_rank is treated as NOT underdog (by design — cohérent partout).

-- ---------------------------------------------------------------------------
-- Helper — single source of truth for the rank predicate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_underdog_rank(p_rider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE  -- reads riders.pcs_rank; STABLE (same result within a transaction)
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT pcs_rank FROM public.riders WHERE id = p_rider_id) > 100,
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- gt_add_to_squad — same body as 20260605000100, + rank gate for underdog
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gt_add_to_squad(
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
  v_user_id          uuid := auth.uid();
  v_team_user_id     uuid;
  v_team_eligible    boolean;
  v_contract_exists  boolean;
  v_already_in_squad boolean;
  v_role_count       int;
  v_cap              int;
  v_use_slug         boolean := p_race_slug IS NOT NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_role NOT IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique','underdog') THEN
    RETURN jsonb_build_object('error', 'Invalid role');
  END IF;

  IF NOT v_use_slug AND p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id (and no race_slug provided)');
  END IF;

  SELECT user_id, underdog_eligible INTO v_team_user_id, v_team_eligible
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  IF p_role = 'underdog' AND NOT COALESCE(v_team_eligible, false) THEN
    RETURN jsonb_build_object('error', 'Underdog role is only available to underdog-eligible teams');
  END IF;

  -- POST-REVIEW FIX (#2/#3): enforce pcs_rank > 100 for underdog role.
  IF p_role = 'underdog' AND NOT public.is_underdog_rank(p_rider_id) THEN
    RETURN jsonb_build_object('error', 'Underdog role requires PCS rank > 100');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contracts
    WHERE team_id = p_team_id AND rider_id = p_rider_id AND status = 'active'
  ) INTO v_contract_exists;

  IF NOT v_contract_exists THEN
    RETURN jsonb_build_object('error', 'Rider has no active contract with this team');
  END IF;

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

-- ---------------------------------------------------------------------------
-- gt_assign_role — same body as 20260605000100, + rank gate for underdog
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
  v_team_eligible boolean;
  v_squad_id     uuid;
  v_cap          int;
  v_demote       record;
  v_use_slug     boolean := p_race_slug IS NOT NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_role NOT IN ('gc_leader','sprinter','climber','tt_specialist','stage_hunter','domestique','underdog') THEN
    RETURN jsonb_build_object('error', 'Invalid role');
  END IF;

  IF NOT v_use_slug AND p_phase_id NOT IN (4, 6, 8) THEN
    RETURN jsonb_build_object('error', 'Invalid phase_id (and no race_slug provided)');
  END IF;

  SELECT user_id, underdog_eligible INTO v_team_user_id, v_team_eligible
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  IF p_role = 'underdog' AND NOT COALESCE(v_team_eligible, false) THEN
    RETURN jsonb_build_object('error', 'Underdog role is only available to underdog-eligible teams');
  END IF;

  -- POST-REVIEW FIX (#2/#3): enforce pcs_rank > 100 for underdog role.
  -- Closes the role-swap exploit (sign rank=80 as domestique, promote to underdog).
  IF p_role = 'underdog' AND NOT public.is_underdog_rank(p_rider_id) THEN
    RETURN jsonb_build_object('error', 'Underdog role requires PCS rank > 100');
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

-- ---------------------------------------------------------------------------
-- flag_underdog_contract — explicit NULL check (cohérent avec les RPCs).
-- NULL pcs_rank = pas underdog par design (cohérent avec gt_add_to_squad / gt_assign_role).
-- Aligne aussi le rescue path : un coureur de remplacement sans pcs_rank > 100
-- ne reçoit pas le discount.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.flag_underdog_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_eligible boolean;
BEGIN
  IF NEW.underdog_discount THEN
    RETURN NEW;  -- respect an explicitly-set flag (e.g. backfill)
  END IF;

  SELECT underdog_eligible INTO v_eligible FROM public.teams WHERE id = NEW.team_id;

  -- POST-REVIEW FIX (#4): explicit NULL check instead of COALESCE(v_rank, 0) > 100.
  -- Single source of truth: is_underdog_rank() (same helper as the RPCs).
  IF COALESCE(v_eligible, false) AND public.is_underdog_rank(NEW.rider_id) THEN
    NEW.underdog_discount := true;
  END IF;

  RETURN NEW;
END;
$$;
