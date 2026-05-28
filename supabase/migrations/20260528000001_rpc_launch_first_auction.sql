-- RPC launch_first_auction: atomic 3-round auction creation with auto-scheduled dates.
-- Replaces the TS server action that computed dates client-side.
-- Round 1 opens immediately, rounds 2-3 are 'scheduled' and open as the previous closes.
-- Per-round window: 24h, evaluated in Europe/Paris time zone.

CREATE OR REPLACE FUNCTION public.launch_first_auction(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_league      record;
  v_today_paris date;
  v_open_1      timestamptz;
  v_open_2      timestamptz;
  v_open_3      timestamptz;
  v_close_3     timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
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

  -- Compute schedule in Europe/Paris.
  v_today_paris := (now() AT TIME ZONE 'Europe/Paris')::date;

  v_open_1 := (v_today_paris::timestamp AT TIME ZONE 'Europe/Paris');
  v_open_2 := ((v_today_paris + INTERVAL '1 day')::timestamp AT TIME ZONE 'Europe/Paris');
  v_open_3 := ((v_today_paris + INTERVAL '2 day')::timestamp AT TIME ZONE 'Europe/Paris');
  v_close_3 := ((v_today_paris + INTERVAL '3 day')::timestamp AT TIME ZONE 'Europe/Paris') - INTERVAL '1 second';

  INSERT INTO public.auctions (league_id, name, status, opens_at, closes_at)
  VALUES
    (p_league_id, 'Round 1', 'open',      v_open_1, v_open_2),
    (p_league_id, 'Round 2', 'scheduled', v_open_2, v_open_3),
    (p_league_id, 'Round 3', 'scheduled', v_open_3, v_close_3);

  UPDATE public.leagues
     SET status = 'active'
   WHERE id = p_league_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.launch_first_auction(uuid) TO authenticated;
