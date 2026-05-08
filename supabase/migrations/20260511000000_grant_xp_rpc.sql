-- RPC grant_xp: atomic admin XP grant with audit trail.
-- Service-role only (no authenticated access) — call via SQL editor or admin client.

CREATE OR REPLACE FUNCTION public.grant_xp(
  p_team_id uuid,
  p_amount numeric,
  p_reason text,
  p_adjusted_at date DEFAULT current_date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team record;
BEGIN
  SELECT id, cumulative_xp INTO v_team
  FROM public.teams
  WHERE id = p_team_id
  FOR UPDATE;

  IF v_team IS NULL THEN
    RETURN jsonb_build_object('error', 'Team not found');
  END IF;

  UPDATE public.teams
  SET cumulative_xp = cumulative_xp + p_amount
  WHERE id = p_team_id;

  INSERT INTO public.team_xp_adjustments (team_id, amount, reason, adjusted_at)
  VALUES (p_team_id, p_amount, p_reason, p_adjusted_at);

  RETURN jsonb_build_object(
    'ok', true,
    'team_id', p_team_id,
    'new_xp', v_team.cumulative_xp + p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_xp(uuid, numeric, text, date) TO service_role;
