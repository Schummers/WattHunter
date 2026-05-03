-- RPC leave_league: atomic league departure with cascade cleanup.
-- Replaces multi-query TS server action.

CREATE OR REPLACE FUNCTION public.leave_league(
  p_league_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_league record;
  v_team record;
  v_active_contracts int;
BEGIN
  -- 1. Auth
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- 2. Check commissioner — can't leave own league
  SELECT * INTO v_league
  FROM public.leagues
  WHERE id = p_league_id;

  IF v_league IS NULL THEN
    RETURN jsonb_build_object('error', 'League not found');
  END IF;

  IF v_league.commissioner_id = v_user_id THEN
    RETURN jsonb_build_object('error', 'Race Directors cannot leave their own league');
  END IF;

  -- 3. Get user's team
  SELECT * INTO v_team
  FROM public.teams
  WHERE user_id = v_user_id AND league_id = p_league_id
  FOR UPDATE;

  IF v_team IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  -- 4. Block if active contracts exist
  SELECT count(*) INTO v_active_contracts
  FROM public.contracts
  WHERE team_id = v_team.id AND status = 'active';

  IF v_active_contracts > 0 THEN
    RETURN jsonb_build_object('error', 'Release all riders before leaving the league');
  END IF;

  -- 5. Cascade cleanup
  UPDATE public.auction_bids
  SET status = 'cancelled'
  WHERE team_id = v_team.id AND status = 'active';

  DELETE FROM public.draft_bids WHERE team_id = v_team.id;
  DELETE FROM public.team_sponsors WHERE team_id = v_team.id;
  DELETE FROM public.team_strategies WHERE team_id = v_team.id;
  DELETE FROM public.teams WHERE id = v_team.id;
  DELETE FROM public.league_members
  WHERE league_id = p_league_id AND user_id = v_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_league(uuid) TO authenticated;
