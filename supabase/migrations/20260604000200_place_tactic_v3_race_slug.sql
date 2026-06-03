-- Spec A (A9) — place_tactic v3: accept race_slug for 1-week stage races,
-- while preserving every safety check from P3a v2 (cutoff, ownership,
-- league-scope, Nemesis profile gating, Nemesis ≥-XP).
-- Backwards-compatible: legacy callers passing only phase_id continue to work
-- (the new p_race_slug trailing arg defaults to NULL).

-- Postgres resolves functions by full type list, not by name. Without dropping
-- the P3a v2 7-arg signature first, the CREATE OR REPLACE below would create a
-- NEW 8-arg function alongside the existing 7-arg one, and the trailing
-- REVOKE / GRANT / COMMENT statements would fail with "function name is not
-- unique" (SQLSTATE 42725).
DROP FUNCTION IF EXISTS public.place_tactic(UUID, INT, INT, TEXT, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.place_tactic(
  p_team_id      UUID,
  p_phase_id     INT,
  p_year         INT,
  p_tactic_type  TEXT,
  p_stage_slug   TEXT,
  p_nemesis_target_team_id UUID DEFAULT NULL,
  p_nemesis_target_role    TEXT DEFAULT NULL,
  p_race_slug    TEXT DEFAULT NULL  -- NEW in v3 (Spec A A9)
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id       UUID;
  v_owner         UUID;
  v_my_league     UUID;
  v_target_league UUID;
  v_attacker_xp   NUMERIC;
  v_target_xp     NUMERIC;
  v_role_filter   TEXT;
  v_new_id        UUID;
  v_stage_date    DATE;
  v_stage_profile TEXT;
  v_race_kind     TEXT;
  v_parent_slug   TEXT;
  v_effective_race_slug TEXT;
  v_effective_phase_id  INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  -- ---------------------------------------------------------------------
  -- Ownership check
  -- ---------------------------------------------------------------------
  SELECT user_id, league_id INTO v_owner, v_my_league
  FROM public.teams WHERE id = p_team_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'team not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_owner <> v_user_id THEN
    RAISE EXCEPTION 'not team owner' USING ERRCODE = '42501';
  END IF;

  -- ---------------------------------------------------------------------
  -- Tactic-type validity
  -- ---------------------------------------------------------------------
  IF p_tactic_type NOT IN
       ('unleash','overdrive','call_the_bus','nemesis_gc','nemesis_sprint') THEN
    RAISE EXCEPTION 'invalid tactic_type %', p_tactic_type
      USING ERRCODE = 'check_violation';
  END IF;

  -- ---------------------------------------------------------------------
  -- Stage_slug shape — must be 'race/<race>/<year>/stage-<N>'.
  -- (No more hard phase_id IN (4,6,8) — 1-week races are now valid.)
  -- ---------------------------------------------------------------------
  IF p_stage_slug !~ '^race/[^/]+/[0-9]{4}/stage-[0-9]+$' THEN
    RAISE EXCEPTION 'invalid stage_slug shape: %', p_stage_slug
      USING ERRCODE = 'check_violation';
  END IF;

  -- Derive parent race slug from the stage slug.
  v_parent_slug := regexp_replace(p_stage_slug, '/stage-[0-9]+$', '');

  -- Pick the effective scope: prefer caller-supplied race_slug, else parent.
  v_effective_race_slug := COALESCE(p_race_slug, v_parent_slug);

  -- Consistency: if both were provided, they must match.
  IF p_race_slug IS NOT NULL AND p_race_slug <> v_parent_slug THEN
    RAISE EXCEPTION 'race_slug % does not match stage_slug parent %', p_race_slug, v_parent_slug
      USING ERRCODE = 'check_violation';
  END IF;

  v_race_kind := public.infer_race_kind(v_effective_race_slug, p_phase_id);

  -- Legacy GT path: derive a phase_id when omitted (back-compat with old front).
  -- Modern path (1-week): leave phase_id NULL.
  IF v_race_kind = 'gt' THEN
    v_effective_phase_id := COALESCE(
      p_phase_id,
      CASE
        WHEN v_effective_race_slug LIKE 'race/giro-d-italia/%'    THEN 4
        WHEN v_effective_race_slug LIKE 'race/tour-de-france/%'   THEN 6
        WHEN v_effective_race_slug LIKE 'race/vuelta-a-espana/%'  THEN 8
      END
    );
  ELSE
    v_effective_phase_id := NULL;
  END IF;

  -- ---------------------------------------------------------------------
  -- 11:00 CET cutoff (unchanged from P3a v2)
  -- ---------------------------------------------------------------------
  SELECT race_date INTO v_stage_date
  FROM public.race_startlists
  WHERE race_slug = p_stage_slug
  LIMIT 1;

  IF v_stage_date IS NOT NULL
     AND v_stage_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')::DATE
     AND (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')::TIME >= TIME '11:00' THEN
    RAISE EXCEPTION 'tactic cutoff has passed for today stage'
      USING ERRCODE = 'check_violation';
  END IF;

  -- ---------------------------------------------------------------------
  -- Nemesis-specific validations
  -- ---------------------------------------------------------------------
  IF p_tactic_type IN ('nemesis_gc','nemesis_sprint') THEN
    IF p_nemesis_target_team_id IS NULL OR p_nemesis_target_role IS NULL THEN
      RAISE EXCEPTION 'nemesis tactics require a target team and role';
    END IF;

    -- ----- Profile gating (Spec A A7, preserved verbatim from P3a v2) -----
    SELECT profile_icon INTO v_stage_profile
    FROM public.stage_profiles
    WHERE race_slug = p_stage_slug
    LIMIT 1;

    IF v_stage_profile IS NULL THEN
      RAISE EXCEPTION 'stage profile unknown for % — run the startlists pipeline first', p_stage_slug
        USING ERRCODE = 'check_violation';
    END IF;

    IF p_tactic_type = 'nemesis_sprint'
       AND v_stage_profile NOT IN ('p1','p2','p3') THEN
      RAISE EXCEPTION 'Nemesis Sprint requires a flat or hilly stage (p1/p2/p3), got %', v_stage_profile
        USING ERRCODE = 'check_violation';
    END IF;

    IF p_tactic_type = 'nemesis_gc'
       AND v_stage_profile NOT IN ('p3','p4','p5') THEN
      RAISE EXCEPTION 'Nemesis GC requires a hilly-uphill or mountain stage (p3/p4/p5), got %', v_stage_profile
        USING ERRCODE = 'check_violation';
    END IF;
    -- ------------------ end preserved P3a block ------------------------

    -- Target must be in same league (unchanged)
    SELECT league_id INTO v_target_league FROM public.teams WHERE id = p_nemesis_target_team_id;
    IF v_target_league IS NULL THEN
      RAISE EXCEPTION 'target team not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_target_league <> v_my_league THEN
      RAISE EXCEPTION 'target team not in same league' USING ERRCODE = '42501';
    END IF;

    v_role_filter := CASE p_tactic_type
      WHEN 'nemesis_gc' THEN 'gc_leader'
      ELSE 'sprinter'
    END;

    -- ≥-XP eligibility.
    -- Modern race_slug-keyed path (v3): scope role assignments + xp to race_slug.
    -- Legacy phase_id-keyed path: kept for back-compat (Giro 2026 callers).
    IF v_effective_race_slug IS NOT NULL THEN
      SELECT COALESCE(SUM(rxd.xp_gained), 0) INTO v_attacker_xp
      FROM public.gt_role_assignments ra
      JOIN public.rider_xp_daily rxd
        ON rxd.team_id = ra.team_id AND rxd.rider_id = ra.rider_id
      WHERE ra.team_id = p_team_id
        AND (ra.race_slug = v_effective_race_slug
             OR (ra.race_slug IS NULL AND ra.phase_id = v_effective_phase_id AND ra.year = p_year))
        AND ra.role = v_role_filter
        AND rxd.race_slug LIKE v_effective_race_slug || '/%'
        AND ra.applied_at = (
          SELECT MAX(applied_at) FROM public.gt_role_assignments
          WHERE team_id = ra.team_id AND rider_id = ra.rider_id
            AND COALESCE(race_slug, '') = COALESCE(ra.race_slug, '')
            AND COALESCE(phase_id, -1) = COALESCE(ra.phase_id, -1)
            AND year = ra.year
        );

      SELECT COALESCE(SUM(rxd.xp_gained), 0) INTO v_target_xp
      FROM public.gt_role_assignments ra
      JOIN public.rider_xp_daily rxd
        ON rxd.team_id = ra.team_id AND rxd.rider_id = ra.rider_id
      WHERE ra.team_id = p_nemesis_target_team_id
        AND (ra.race_slug = v_effective_race_slug
             OR (ra.race_slug IS NULL AND ra.phase_id = v_effective_phase_id AND ra.year = p_year))
        AND ra.role = v_role_filter
        AND rxd.race_slug LIKE v_effective_race_slug || '/%'
        AND ra.applied_at = (
          SELECT MAX(applied_at) FROM public.gt_role_assignments
          WHERE team_id = ra.team_id AND rider_id = ra.rider_id
            AND COALESCE(race_slug, '') = COALESCE(ra.race_slug, '')
            AND COALESCE(phase_id, -1) = COALESCE(ra.phase_id, -1)
            AND year = ra.year
        );
    ELSE
      -- Pure legacy fallback (race_slug not derivable — should not happen
      -- given the stage_slug regex, but defensive).
      SELECT COALESCE(SUM(rxd.xp_gained), 0) INTO v_attacker_xp
      FROM public.gt_role_assignments ra
      JOIN public.rider_xp_daily rxd
        ON rxd.team_id = ra.team_id AND rxd.rider_id = ra.rider_id
      WHERE ra.team_id = p_team_id
        AND ra.phase_id = v_effective_phase_id AND ra.year = p_year
        AND ra.role = v_role_filter
        AND ra.applied_at = (
          SELECT MAX(applied_at) FROM public.gt_role_assignments
          WHERE team_id = ra.team_id AND rider_id = ra.rider_id
            AND phase_id = ra.phase_id AND year = ra.year
        );
      SELECT COALESCE(SUM(rxd.xp_gained), 0) INTO v_target_xp
      FROM public.gt_role_assignments ra
      JOIN public.rider_xp_daily rxd
        ON rxd.team_id = ra.team_id AND rxd.rider_id = ra.rider_id
      WHERE ra.team_id = p_nemesis_target_team_id
        AND ra.phase_id = v_effective_phase_id AND ra.year = p_year
        AND ra.role = v_role_filter
        AND ra.applied_at = (
          SELECT MAX(applied_at) FROM public.gt_role_assignments
          WHERE team_id = ra.team_id AND rider_id = ra.rider_id
            AND phase_id = ra.phase_id AND year = ra.year
        );
    END IF;

    IF v_target_xp < v_attacker_xp THEN
      RAISE EXCEPTION 'target must have >= your race XP (you=%, target=%)',
        v_attacker_xp, v_target_xp;
    END IF;
  ELSE
    IF p_nemesis_target_team_id IS NOT NULL OR p_nemesis_target_role IS NOT NULL THEN
      RAISE EXCEPTION 'nemesis fields must be NULL for non-nemesis tactics';
    END IF;
  END IF;

  -- ---------------------------------------------------------------------
  -- Insert (write BOTH phase_id and race_slug; trigger reads either)
  -- ---------------------------------------------------------------------
  INSERT INTO public.gt_tactic_activations(
    team_id, phase_id, year, tactic_type, stage_slug,
    nemesis_target_team_id, nemesis_target_role,
    race_slug
  )
  VALUES (
    p_team_id, v_effective_phase_id, p_year, p_tactic_type, p_stage_slug,
    p_nemesis_target_team_id, p_nemesis_target_role,
    v_effective_race_slug
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.place_tactic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_tactic TO authenticated;

COMMENT ON FUNCTION public.place_tactic IS
  'v3 (Spec A A9): accept race_slug for 1-week stage races. Preserves P3a Nemesis profile gating. Back-compatible with legacy phase_id-only callers (Giro 2026).';
