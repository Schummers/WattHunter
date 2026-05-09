-- Fix two bugs in GT squad RPCs:
-- 1. gt_assign_role: demoting to domestique didn't check the domestique cap (max 2)
-- 2. gt_add_to_squad: no total squad size cap (max 8)
-- Data fix: soft-delete Edward Planckaert from bigdaddy's squad (3rd domestique, over cap)

-- ---------------------------------------------------------------------------
-- 0. Data fix — remove the extra domestique from bigdaddy's Giro squad
-- ---------------------------------------------------------------------------
UPDATE public.gt_squad
SET removed_at = now()
WHERE id = '9e8da401-9985-467a-bcc6-bb38f218e4fd';

-- ---------------------------------------------------------------------------
-- 1. gt_assign_role — check domestique cap before demoting
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
  v_domestique_count int;
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
    WHEN 'gc_leader'     THEN 1
    WHEN 'sprinter'      THEN 1
    WHEN 'climber'       THEN 1
    WHEN 'tt_specialist' THEN 1
    WHEN 'stage_hunter'  THEN 2
    WHEN 'domestique'    THEN 2
  END;

  -- If target role is at cap, demote the oldest holder — but first check
  -- that demoting to domestique won't also exceed its cap (max 2).
  IF (
    SELECT COUNT(*) FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND role = p_role AND removed_at IS NULL AND rider_id <> p_rider_id
  ) >= v_cap THEN

    -- Only need to check domestique overflow when the demotion target is not already domestique.
    IF p_role <> 'domestique' THEN
      SELECT COUNT(*) INTO v_domestique_count
      FROM public.gt_squad
      WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
        AND role = 'domestique' AND removed_at IS NULL AND rider_id <> p_rider_id;

      IF v_domestique_count >= 2 THEN
        RETURN jsonb_build_object(
          'error',
          format(
            'Role %s is at capacity (%s) and demoting the displaced holder to domestique would exceed its cap (2). Free a domestique slot first.',
            p_role, v_cap
          )
        );
      END IF;
    END IF;

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

-- ---------------------------------------------------------------------------
-- 2. gt_add_to_squad — enforce total squad cap (max 8)
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
  v_squad_total int;
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

  SELECT user_id, league_id INTO v_team_user_id, v_team_league_id
  FROM public.teams WHERE id = p_team_id FOR UPDATE;

  IF v_team_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  IF v_team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not team owner');
  END IF;

  -- Total squad cap (max 8 riders in GT squad regardless of team level).
  SELECT COUNT(*) INTO v_squad_total
  FROM public.gt_squad
  WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
    AND removed_at IS NULL;

  IF v_squad_total >= 8 THEN
    RETURN jsonb_build_object('error', 'GT squad is full (max 8 riders)');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contracts
    WHERE team_id = p_team_id AND rider_id = p_rider_id AND status = 'active'
  ) INTO v_contract_exists;

  IF NOT v_contract_exists THEN
    RETURN jsonb_build_object('error', 'Rider has no active contract with this team');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.gt_squad
    WHERE team_id = p_team_id AND phase_id = p_phase_id AND year = p_year
      AND rider_id = p_rider_id AND removed_at IS NULL
  ) INTO v_already_in_squad;

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
