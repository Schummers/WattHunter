-- Restrict leagues SELECT so invite_code is never exposed to non-members.
-- The join flow goes through a SECURITY DEFINER RPC.

DROP POLICY IF EXISTS "leagues_select_authenticated" ON public.leagues;

CREATE POLICY "leagues_select_member_or_commissioner" ON public.leagues
FOR SELECT USING (
  auth.uid() = commissioner_id
  OR EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_members.league_id = leagues.id
      AND league_members.user_id = auth.uid()
  )
);

-- join_league_by_code: atomic lookup + insert so the client never sees invite_code.
-- Returns jsonb with 'ok', 'league_id', 'team_id', 'starting_level' on success,
-- or 'error' string on failure.
CREATE OR REPLACE FUNCTION public.join_league_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_league       record;
  v_team_id      uuid;
  v_start_level  int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_code IS NULL OR length(p_code) < 4 OR length(p_code) > 16 THEN
    RETURN jsonb_build_object('error', 'Invalid code format');
  END IF;

  SELECT id, name, status, max_players, starting_level
    INTO v_league
    FROM public.leagues
   WHERE invite_code = p_code;

  IF v_league IS NULL THEN
    RETURN jsonb_build_object('error', 'League not found');
  END IF;

  -- Active leagues are closed to new members
  IF v_league.status = 'active' THEN
    RETURN jsonb_build_object('error', 'League has already started');
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
      'ok', true,
      'already_member', true,
      'league_id', v_league.id,
      'team_id', v_team_id,
      'starting_level', v_league.starting_level
    );
  END IF;

  -- League full?
  IF (
    SELECT count(*) FROM public.league_members WHERE league_id = v_league.id
  ) >= v_league.max_players THEN
    RETURN jsonb_build_object('error', 'League is full');
  END IF;

  v_start_level := COALESCE(v_league.starting_level, 1);

  -- Insert team first so league_members.team_id FK can be satisfied
  INSERT INTO public.teams (league_id, user_id, name, level, cumulative_xp)
    VALUES (v_league.id, v_user_id, 'My Team', v_start_level, 0)
    RETURNING id INTO v_team_id;

  -- Insert membership
  INSERT INTO public.league_members (league_id, user_id, team_id)
    VALUES (v_league.id, v_user_id, v_team_id);

  RETURN jsonb_build_object(
    'ok', true,
    'league_id', v_league.id,
    'team_id', v_team_id,
    'starting_level', v_start_level
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_league_by_code(text) TO authenticated;
