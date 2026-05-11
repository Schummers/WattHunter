-- ============================================================
-- GT Rescue Window — fixes
-- Corrected version of two RPCs from 20260519000000:
--   1. gt_squad.year (not gt_year) in gt_claim_dnf_refund + gt_place_emergency_bid
--   2. FOR UPDATE row lock in gt_claim_dnf_refund
--   3. Explicit GRANT EXECUTE on grant_xp to supabase_admin
-- ============================================================

-- ============================================================
-- RPC gt_claim_dnf_refund (corrected)
-- ============================================================
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

  -- Validate gt_squad entry: must have dnf_stage set, not yet claimed, owned by caller
  -- Fix: gt_squad uses column "year", not "gt_year"
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

  -- Lock team row to prevent concurrent treasury mutations
  PERFORM 1 FROM public.teams WHERE id = v_team_id FOR UPDATE;

  -- Derive gt_identifier from phase_id
  v_gt_id := CASE v_phase_id
    WHEN 4 THEN 'giro-d-italia'
    WHEN 6 THEN 'tour-de-france'
    WHEN 8 THEN 'vuelta-a-espana'
  END;

  -- Get locked_salary from the active contract
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

  -- Get rider name for audit logs
  SELECT full_name INTO v_rider_name FROM public.riders WHERE id = v_rider_id;

  -- Sum GT XP earned by this rider for this team on this GT
  SELECT COALESCE(SUM(xp_gained), 0) INTO v_xp_total
  FROM public.rider_xp_daily
  WHERE team_id = v_team_id
    AND rider_id = v_rider_id
    AND race_slug LIKE 'race/' || v_gt_id || '/' || v_gt_year || '%';

  -- Retroactively forfeit XP.
  -- grant_xp has GRANT EXECUTE TO service_role + supabase_admin.
  -- This SECURITY DEFINER function runs as the postgres superuser, so the call succeeds.
  -- The explicit supabase_admin GRANT (end of migration) documents this dependency.
  IF v_xp_total > 0 THEN
    PERFORM public.grant_xp(
      v_team_id,
      -v_xp_total,
      'GT DNF forfeit — ' || v_rider_name
    );
  END IF;

  -- Credit 50% refund to treasury
  INSERT INTO public.treasury_log (team_id, type, amount, description, rider_id)
  VALUES (v_team_id, 'gt_dnf_refund', v_refund, 'GT DNF refund 50% — ' || v_rider_name, v_rider_id);

  UPDATE public.teams SET treasury = treasury + v_refund WHERE id = v_team_id;

  -- Mark DNF as claimed + soft-delete from squad (same as gt_remove_from_squad)
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

GRANT EXECUTE ON FUNCTION public.gt_claim_dnf_refund(uuid, uuid) TO authenticated;

-- ============================================================
-- RPC gt_place_emergency_bid (corrected)
-- ============================================================
CREATE OR REPLACE FUNCTION public.gt_place_emergency_bid(
  p_rider_id      uuid,
  p_amount        int,
  p_phase_id      int,
  p_gt_identifier text,
  p_gt_year       int,
  p_league_id     uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team_id uuid;
  v_treasury bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'not authenticated');
  END IF;

  -- Get team in this league
  SELECT t.id, t.treasury INTO v_team_id, v_treasury
  FROM public.teams t
  WHERE t.league_id = p_league_id AND t.user_id = auth.uid();

  IF v_team_id IS NULL THEN
    RETURN jsonb_build_object('error', 'team not found');
  END IF;

  -- Eligibility gate: team must have claimed a DNF refund for this GT
  -- Fix: gt_squad uses column "year", not "gt_year"
  IF NOT EXISTS (
    SELECT 1 FROM public.gt_squad
    WHERE team_id = v_team_id
      AND phase_id = p_phase_id
      AND year = p_gt_year
      AND dnf_refund_claimed = true
  ) THEN
    RETURN jsonb_build_object('error', 'no DNF refund claimed for this GT');
  END IF;

  -- Max 1 active emergency bid per team per GT
  IF EXISTS (
    SELECT 1 FROM public.gt_emergency_bids
    WHERE team_id = v_team_id
      AND phase_id = p_phase_id
      AND gt_identifier = p_gt_identifier
      AND gt_year = p_gt_year
      AND resolved = false
  ) THEN
    RETURN jsonb_build_object('error', 'already have an active emergency bid');
  END IF;

  -- Rider must not already be contracted in this league
  IF EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.teams t ON t.id = c.team_id
    WHERE c.rider_id = p_rider_id
      AND t.league_id = p_league_id
      AND c.status = 'active'
  ) THEN
    RETURN jsonb_build_object('error', 'rider already contracted in this league');
  END IF;

  -- Amount validation
  IF p_amount < 5000 OR p_amount % 100 != 0 THEN
    RETURN jsonb_build_object('error', 'amount must be >= 5000 and a multiple of 100');
  END IF;

  -- Solvency check
  IF v_treasury < p_amount THEN
    RETURN jsonb_build_object('error', 'insufficient treasury');
  END IF;

  INSERT INTO public.gt_emergency_bids (
    league_id, team_id, rider_id, amount, phase_id, gt_identifier, gt_year
  ) VALUES (
    p_league_id, v_team_id, p_rider_id, p_amount, p_phase_id, p_gt_identifier, p_gt_year
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gt_place_emergency_bid(uuid, int, int, text, int, uuid) TO authenticated;

-- Explicit grant so gt_claim_dnf_refund can call grant_xp from SECURITY DEFINER context
GRANT EXECUTE ON FUNCTION public.grant_xp(uuid, numeric, text, date) TO supabase_admin;
