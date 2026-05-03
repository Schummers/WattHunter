-- RPC confirm_phase_setup: atomic phase confirmation with sponsor + strategy application.
-- Replaces multi-query TS server action.

CREATE OR REPLACE FUNCTION public.confirm_phase_setup(
  p_team_id uuid,
  p_current_phase_id int,
  p_current_phase_label text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team record;
  v_strat record;
BEGIN
  -- 1. Auth
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- 2. Fetch team (verifies ownership)
  SELECT * INTO v_team
  FROM public.teams
  WHERE id = p_team_id AND user_id = v_user_id
  FOR UPDATE;

  IF v_team IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  -- 3. Guard: already confirmed for this phase
  IF v_team.phase_confirmed_id = p_current_phase_id THEN
    RETURN jsonb_build_object('error', 'Already confirmed for this phase');
  END IF;

  -- 4. Apply pending sponsor change
  IF v_team.pending_sponsor_id IS NOT NULL THEN
    INSERT INTO public.team_sponsors (team_id, sponsor_id, activated_at)
    VALUES (p_team_id, v_team.pending_sponsor_id, now())
    ON CONFLICT (team_id) DO UPDATE
    SET sponsor_id = EXCLUDED.sponsor_id, activated_at = EXCLUDED.activated_at;

    UPDATE public.teams
    SET pending_sponsor_id = NULL
    WHERE id = p_team_id;
  END IF;

  -- 5. Apply pending strategy changes
  FOR v_strat IN
    SELECT id, pending_is_active, pending_config
    FROM public.team_strategies
    WHERE team_id = p_team_id
      AND pending_is_active IS NOT NULL
  LOOP
    IF v_strat.pending_is_active = false THEN
      DELETE FROM public.team_strategies WHERE id = v_strat.id;
    ELSE
      UPDATE public.team_strategies
      SET is_active = COALESCE(v_strat.pending_is_active, true),
          config = v_strat.pending_config,
          activated_at = now(),
          pending_is_active = NULL,
          pending_config = NULL
      WHERE id = v_strat.id;
    END IF;
  END LOOP;

  -- 6. Mark confirmed
  UPDATE public.teams
  SET phase_confirmed_at = now(),
      phase_confirmed_id = p_current_phase_id
  WHERE id = p_team_id;

  RETURN jsonb_build_object(
    'ok', true,
    'phaseId', p_current_phase_id,
    'phaseLabel', p_current_phase_label
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_phase_setup(uuid, int, text) TO authenticated;
