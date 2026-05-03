-- RPC release_rider: atomic rider release with ownership + phase lock checks.
-- Replaces multi-query TS server action.

CREATE OR REPLACE FUNCTION public.release_rider(
  p_contract_id uuid,
  p_current_phase_id int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_contract record;
  v_team record;
BEGIN
  -- 1. Auth
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- 2. Fetch contract + team
  SELECT c.*, t.user_id AS team_user_id, t.league_id
  INTO v_contract
  FROM public.contracts c
  JOIN public.teams t ON t.id = c.team_id
  WHERE c.id = p_contract_id;

  IF v_contract IS NULL THEN
    RETURN jsonb_build_object('error', 'Contract not found');
  END IF;

  -- 3. Ownership check
  IF v_contract.team_user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- 4. Status check
  IF v_contract.status <> 'active' THEN
    RETURN jsonb_build_object('error', 'Contract is not active');
  END IF;

  -- 5. Phase lock: can't release rider recruited this phase
  IF v_contract.phase_recruited_id = p_current_phase_id THEN
    RETURN jsonb_build_object('error', 'Cannot release a rider recruited during the current phase');
  END IF;

  -- 6. Update contract to released
  UPDATE public.contracts
  SET status = 'released', released_at = now()
  WHERE id = p_contract_id;

  -- 7. Delete draft bids for this rider from this team
  DELETE FROM public.draft_bids
  WHERE team_id = v_contract.team_id
    AND rider_id = v_contract.rider_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_rider(uuid, int) TO authenticated;
