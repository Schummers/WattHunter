-- Rollback for 20260603000100 — restore the pre-P3a place_tactic
-- (cutoff check only, no Nemesis profile gating).
--
-- This is a VERBATIM copy of the CREATE OR REPLACE FUNCTION place_tactic body
-- from supabase/migrations/20260510100000_place_tactic_cutoff_check.sql.

CREATE OR REPLACE FUNCTION place_tactic(
  p_team_id      UUID,
  p_phase_id     INT,
  p_year         INT,
  p_tactic_type  TEXT,
  p_stage_slug   TEXT,
  p_nemesis_target_team_id UUID DEFAULT NULL,
  p_nemesis_target_role    TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id     UUID;
  v_owner       UUID;
  v_my_league   UUID;
  v_target_league UUID;
  v_attacker_xp NUMERIC;
  v_target_xp   NUMERIC;
  v_gt_slug_pattern TEXT;
  v_role_filter TEXT;
  v_new_id      UUID;
  v_stage_date  DATE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Ownership check
  SELECT user_id, league_id INTO v_owner, v_my_league
  FROM teams WHERE id = p_team_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'team not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_owner != v_user_id THEN
    RAISE EXCEPTION 'not team owner' USING ERRCODE = '42501';
  END IF;

  -- Tactic-type validity (also enforced by table CHECK, but fail early)
  IF p_tactic_type NOT IN
       ('unleash','overdrive','call_the_bus','nemesis_gc','nemesis_sprint') THEN
    RAISE EXCEPTION 'invalid tactic_type %', p_tactic_type
      USING ERRCODE = 'check_violation';
  END IF;

  -- Phase validity (must be a GT phase: 4=Giro, 6=Tour, 8=Vuelta)
  IF p_phase_id NOT IN (4, 6, 8) THEN
    RAISE EXCEPTION 'phase % is not a GT phase', p_phase_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- GT slug pattern for the phase
  v_gt_slug_pattern := CASE p_phase_id
    WHEN 4 THEN 'race/giro-d-italia/' || p_year || '/%'
    WHEN 6 THEN 'race/tour-de-france/' || p_year || '/%'
    WHEN 8 THEN 'race/vuelta-a-espana/' || p_year || '/%'
  END;

  -- Stage_slug must belong to this GT phase
  IF p_stage_slug NOT LIKE v_gt_slug_pattern THEN
    RAISE EXCEPTION 'stage_slug % does not belong to phase %', p_stage_slug, p_phase_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- 11:00 CET cutoff: block tactic placement on today's stage after cutoff
  SELECT race_date INTO v_stage_date
  FROM race_startlists
  WHERE race_slug = p_stage_slug
  LIMIT 1;

  IF v_stage_date IS NOT NULL
     AND v_stage_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')::DATE
     AND (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')::TIME >= TIME '11:00' THEN
    RAISE EXCEPTION 'tactic cutoff has passed for today stage'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Nemesis-specific validations
  IF p_tactic_type IN ('nemesis_gc','nemesis_sprint') THEN
    IF p_nemesis_target_team_id IS NULL OR p_nemesis_target_role IS NULL THEN
      RAISE EXCEPTION 'nemesis tactics require a target team and role';
    END IF;

    -- Target must be in same league
    SELECT league_id INTO v_target_league FROM teams WHERE id = p_nemesis_target_team_id;
    IF v_target_league IS NULL THEN
      RAISE EXCEPTION 'target team not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_target_league != v_my_league THEN
      RAISE EXCEPTION 'target team not in same league' USING ERRCODE = '42501';
    END IF;

    -- Eligibility: target_gt_xp >= attacker_gt_xp.
    -- "GT XP" = sum of xp_gained for the rider whose CURRENT role (latest applied_at)
    -- is the relevant role, restricted to this GT's race slugs.
    v_role_filter := CASE p_tactic_type
      WHEN 'nemesis_gc' THEN 'gc_leader'
      ELSE 'sprinter'
    END;

    -- Attacker GT XP
    SELECT COALESCE(SUM(rxd.xp_gained), 0) INTO v_attacker_xp
    FROM gt_role_assignments ra
    JOIN rider_xp_daily rxd ON rxd.team_id = ra.team_id AND rxd.rider_id = ra.rider_id
    WHERE ra.team_id = p_team_id
      AND ra.phase_id = p_phase_id
      AND ra.year = p_year
      AND ra.role = v_role_filter
      AND rxd.race_slug LIKE v_gt_slug_pattern
      AND ra.applied_at = (
        SELECT MAX(applied_at) FROM gt_role_assignments
        WHERE team_id = ra.team_id AND rider_id = ra.rider_id
          AND phase_id = ra.phase_id AND year = ra.year
      );

    -- Target GT XP
    SELECT COALESCE(SUM(rxd.xp_gained), 0) INTO v_target_xp
    FROM gt_role_assignments ra
    JOIN rider_xp_daily rxd ON rxd.team_id = ra.team_id AND rxd.rider_id = ra.rider_id
    WHERE ra.team_id = p_nemesis_target_team_id
      AND ra.phase_id = p_phase_id
      AND ra.year = p_year
      AND ra.role = v_role_filter
      AND rxd.race_slug LIKE v_gt_slug_pattern
      AND ra.applied_at = (
        SELECT MAX(applied_at) FROM gt_role_assignments
        WHERE team_id = ra.team_id AND rider_id = ra.rider_id
          AND phase_id = ra.phase_id AND year = ra.year
      );

    IF v_target_xp < v_attacker_xp THEN
      RAISE EXCEPTION 'target must have >= your GT XP (you=%, target=%)',
        v_attacker_xp, v_target_xp;
    END IF;
  ELSE
    -- Non-nemesis: nemesis fields must be NULL
    IF p_nemesis_target_team_id IS NOT NULL OR p_nemesis_target_role IS NOT NULL THEN
      RAISE EXCEPTION 'nemesis fields must be NULL for non-nemesis tactics';
    END IF;
  END IF;

  -- Insert (table CHECK + usage-limit trigger handle the rest)
  INSERT INTO gt_tactic_activations(
    team_id, phase_id, year, tactic_type, stage_slug,
    nemesis_target_team_id, nemesis_target_role
  )
  VALUES (
    p_team_id, p_phase_id, p_year, p_tactic_type, p_stage_slug,
    p_nemesis_target_team_id, p_nemesis_target_role
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION place_tactic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_tactic TO authenticated;

COMMENT ON FUNCTION place_tactic IS
  'Validate + insert a GT tactic activation. SECURITY DEFINER. Authenticated team owner only. Enforces 11:00 CET cutoff for today stages, same-league-only Nemesis target, ≥-attacker-XP eligibility, GT-phase-bound stage_slug, and forwards CHECK + usage-limit trigger errors.';
