-- Fix: classic_phase_reset raised 'Team not found' for any team whose
-- phase_confirmed_id was still NULL.
--
-- The existence guard read the column into a variable and tested that variable
-- for NULL, which conflates two different things:
--   * no row for p_team_id            -> v_already IS NULL
--   * row exists, column is NULL      -> v_already IS NULL  (false positive)
--
-- phase_confirmed_id is NULL for every team that has never completed a phase
-- transition, i.e. every team of a classic league still on its first phase.
-- The reset was therefore impossible to run on exactly the case it is needed
-- for first, and triggerPhasePayday swallows per-team errors, so the cascade
-- failed silently instead of surfacing.
--
-- Fix: use FOUND for the existence check and keep phase_confirmed_id purely as
-- the idempotency marker. Behaviour is otherwise identical, including the
-- 'skipped' short-circuit when the phase is already confirmed.

CREATE OR REPLACE FUNCTION public.classic_phase_reset(
  p_team_id uuid,
  p_phase_id int,
  p_phase_label text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget constant int := 2000000;
  v_already int;
BEGIN
  SELECT phase_confirmed_id INTO v_already FROM teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team % not found', p_team_id;
  END IF;
  -- NULL (never confirmed a phase) is distinct from p_phase_id, so a first-ever
  -- reset proceeds instead of short-circuiting.
  IF v_already IS NOT DISTINCT FROM p_phase_id THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'phaseId', p_phase_id);
  END IF;

  -- Archive the previous phase's roster so the new auction starts empty.
  UPDATE contracts
     SET status = 'released',
         released_at = now(),
         available_from = now()
   WHERE team_id = p_team_id
     AND status IN ('active', 'notice');

  -- Flat budget reset + mark phase confirmed.
  UPDATE teams
     SET treasury = v_budget,
         phase_confirmed_id = p_phase_id,
         phase_confirmed_at = now()
   WHERE id = p_team_id;

  INSERT INTO treasury_log (team_id, type, amount, description)
  VALUES (p_team_id, 'budget_reset', v_budget,
          'Classic budget reset — ' || p_phase_label);

  RETURN jsonb_build_object('ok', true, 'skipped', false,
                            'phaseId', p_phase_id, 'budget', v_budget);
END;
$$;

GRANT EXECUTE ON FUNCTION public.classic_phase_reset(uuid, int, text)
  TO authenticated, service_role;
