-- RPC set_starting_level: commissioner-only update of leagues.starting_level (1..8).
-- Only allowed while the league is still in 'pending' status.

CREATE OR REPLACE FUNCTION public.set_starting_level(
  p_league_id uuid,
  p_level     integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_league  record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  IF p_level IS NULL OR p_level < 1 OR p_level > 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_level');
  END IF;

  SELECT id, commissioner_id, status
    INTO v_league
    FROM public.leagues
   WHERE id = p_league_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'league_not_found');
  END IF;

  IF v_league.commissioner_id <> v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_commissioner');
  END IF;

  IF v_league.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_started');
  END IF;

  UPDATE public.leagues
     SET starting_level = p_level
   WHERE id = p_league_id;

  RETURN jsonb_build_object('ok', true, 'level', p_level);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_starting_level(uuid, integer) TO authenticated;
