CREATE OR REPLACE FUNCTION public.gt_claim_dnf_refund(
  p_gt_squad_id uuid,
  p_contract_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team_id     uuid;
  v_rider_id    uuid;
  v_salary      int;
  v_refund      int;
  v_xp_total    numeric;
  v_gt_id       text;
  v_phase_id    int;
  v_gt_year     int;
  v_rider_name  text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'not authenticated');
  END IF;

  SELECT gs.team_id, gs.rider_id, gs.phase_id, gs.year
  INTO v_team_id, v_rider_id, v_phase_id, v_gt_year
  FROM public.gt_squad gs
  JOIN public.teams t ON t.id = gs.team_id
  WHERE gs.id = p_gt_squad_id
    AND gs.dnf_stage IS NOT NULL
    AND gs.dnf_refund_claimed = false
    AND t.user_id = auth.uid();

  IF v_team_id IS NULL THEN
    RETURN jsonb_build_object('error', 'DNF entry not found or already claimed');
  END IF;

  PERFORM 1 FROM public.teams WHERE id = v_team_id FOR UPDATE;

  v_gt_id := CASE v_phase_id
    WHEN 4 THEN 'giro-d-italia'
    WHEN 6 THEN 'tour-de-france'
    WHEN 8 THEN 'vuelta-a-espana'
  END;

  SELECT c.locked_salary INTO v_salary
  FROM public.contracts c
  WHERE c.id = p_contract_id
    AND c.team_id = v_team_id
    AND c.rider_id = v_rider_id
    AND c.status = 'active';

  IF v_salary IS NULL THEN
    RETURN jsonb_build_object('error', 'active contract not found');
  END IF;

  v_refund := ROUND(v_salary * 0.5);

  -- Fix: full_name (not name)
  SELECT full_name INTO v_rider_name FROM public.riders WHERE id = v_rider_id;

  -- Fix: xp_gained (not xp)
  SELECT COALESCE(SUM(xp_gained), 0) INTO v_xp_total
  FROM public.rider_xp_daily
  WHERE team_id = v_team_id
    AND rider_id = v_rider_id
    AND race_slug LIKE 'race/' || v_gt_id || '/' || v_gt_year || '%';

  IF v_xp_total > 0 THEN
    PERFORM public.grant_xp(
      v_team_id,
      -v_xp_total,
      'GT DNF forfeit — ' || v_rider_name
    );
  END IF;

  INSERT INTO public.treasury_log (team_id, type, amount, description, rider_id)
  VALUES (v_team_id, 'gt_dnf_refund', v_refund, 'GT DNF refund 50% — ' || v_rider_name, v_rider_id);

  UPDATE public.teams SET treasury = treasury + v_refund WHERE id = v_team_id;

  UPDATE public.gt_squad
  SET dnf_refund_claimed = true, removed_at = now()
  WHERE id = p_gt_squad_id;

  RETURN jsonb_build_object(
    'ok', true,
    'refund_amount', v_refund,
    'xp_forfeited', v_xp_total
  );
END;
$$;
