-- Rollback for 20260703000000_join_league_classic_late_join.sql
-- Restores the previous production definition (20260529000003_join_rejects_demo.sql):
-- late-join branch uses averaged level/treasury for ALL modes (manager-only logic).

CREATE OR REPLACE FUNCTION public.join_league_by_code(p_code text, p_team_name text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id         uuid := auth.uid();
  v_league          record;
  v_team_id         uuid;
  v_start_level     int;
  v_avg_xp          numeric(10,2);
  v_avg_treasury    bigint;
  v_can_join_now    boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_code IS NULL OR length(p_code) < 4 OR length(p_code) > 16 THEN
    RETURN jsonb_build_object('error', 'Invalid code format');
  END IF;

  SELECT id, name, status, max_players, starting_level, is_demo
    INTO v_league
    FROM public.leagues
   WHERE invite_code = p_code;

  IF v_league IS NULL THEN
    RETURN jsonb_build_object('error', 'League not found');
  END IF;

  -- Demo leagues are read-only; real users may not join them
  IF v_league.is_demo THEN
    RETURN jsonb_build_object('ok', false, 'error', 'league_is_demo');
  END IF;

  -- Already a member — return existing state so the client can redirect
  IF EXISTS (
    SELECT 1 FROM public.league_members
     WHERE league_id = v_league.id AND user_id = v_user_id
  ) THEN
    SELECT t.id INTO v_team_id
      FROM public.teams t
     WHERE t.league_id = v_league.id AND t.user_id = v_user_id;
    RETURN jsonb_build_object(
      'ok',             true,
      'already_member', true,
      'league_id',      v_league.id,
      'team_id',        v_team_id,
      'starting_level', v_league.starting_level
    );
  END IF;

  -- League full?
  IF (
    SELECT count(*) FROM public.league_members WHERE league_id = v_league.id
  ) >= v_league.max_players THEN
    RETURN jsonb_build_object('error', 'League is full');
  END IF;

  -- Completed leagues are closed to new members
  IF v_league.status = 'completed' THEN
    RETURN jsonb_build_object('error', 'League has ended');
  END IF;

  -- ── STANDARD JOIN (league not yet active) ────────────────────────────────
  IF v_league.status != 'active' THEN
    v_start_level := COALESCE(v_league.starting_level, 1);

    INSERT INTO public.teams (league_id, user_id, name, level, cumulative_xp)
      VALUES (v_league.id, v_user_id, COALESCE(NULLIF(TRIM(p_team_name), ''), 'My Team'), v_start_level, 0)
      RETURNING id INTO v_team_id;

    INSERT INTO public.league_members (league_id, user_id, team_id)
      VALUES (v_league.id, v_user_id, v_team_id);

    RETURN jsonb_build_object(
      'ok',             true,
      'league_id',      v_league.id,
      'team_id',        v_team_id,
      'starting_level', v_start_level,
      'late_join',      false
    );
  END IF;

  -- ── LATE JOIN (league already active) ────────────────────────────────────
  -- Compute averages from existing teams in this league
  SELECT
    COALESCE(AVG(cumulative_xp), 0)::numeric(10,2),
    (ROUND(COALESCE(AVG(treasury), 200000) / 100.0) * 100)::bigint
  INTO v_avg_xp, v_avg_treasury
  FROM public.teams
  WHERE league_id = v_league.id;

  -- Derive level from average XP — delegate to the canonical function
  v_start_level := public.compute_level(v_avg_xp);

  -- Insert team with average values — no sponsor, no strategies
  INSERT INTO public.teams (league_id, user_id, name, level, cumulative_xp, treasury)
    VALUES (v_league.id, v_user_id, COALESCE(NULLIF(TRIM(p_team_name), ''), 'My Team'), v_start_level, v_avg_xp, v_avg_treasury)
    RETURNING id INTO v_team_id;

  INSERT INTO public.league_members (league_id, user_id, team_id)
    VALUES (v_league.id, v_user_id, v_team_id);

  SELECT (
    NOT EXISTS (
      SELECT 1 FROM public.auctions closed_a
       WHERE closed_a.league_id = v_league.id
         AND closed_a.status = 'closed'
         AND closed_a.opens_at < COALESCE(
               (SELECT MIN(a2.opens_at)
                  FROM public.auctions a2
                 WHERE a2.league_id = v_league.id
                   AND a2.status IN ('open', 'scheduled', 'resolving')),
               'infinity'::timestamptz
             )
    )
  ) INTO v_can_join_now;

  RETURN jsonb_build_object(
    'ok',                   true,
    'league_id',            v_league.id,
    'team_id',              v_team_id,
    'starting_level',       v_start_level,
    'late_join',            true,
    'can_join_current_phase', v_can_join_now
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.join_league_by_code(text, text) TO authenticated;
