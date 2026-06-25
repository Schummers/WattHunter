-- Classic League Mode: per-phase economy reset.
-- Replaces the manager-mode payday (sponsor income - salaries) for classic
-- leagues. At the start of each classic phase, every team's roster from the
-- previous phase is archived and the treasury is reset to a flat budget.

-- 1. Allow the 'budget_reset' treasury_log type (full list from 20260520000000 + new).
ALTER TABLE public.treasury_log DROP CONSTRAINT IF EXISTS treasury_log_type_check;
ALTER TABLE public.treasury_log ADD CONSTRAINT treasury_log_type_check CHECK (
  type = ANY (ARRAY[
    'starting_fund', 'auction_purchase', 'monthly_salary', 'rider_revenue',
    'sponsor_payment', 'bankruptcy_release', 'monthly_bonus', 'phase_salary',
    'phase_sponsor_base', 'sponsor_bonus', 'release_fee', 'transfer_bonus',
    'payday_salary', 'gt_dnf_refund', 'gt_emergency_purchase', 'gt_goal_bonus',
    'sponsor_bonus_revert', 'budget_reset'
  ])
);

-- 2. classic_phase_reset(team, phase, label):
--    archive prior-phase roster, reset treasury to the flat classic budget,
--    mark the phase confirmed. Idempotent on phase_confirmed_id.
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
  v_budget constant int := 1500000;
  v_already int;
BEGIN
  SELECT phase_confirmed_id INTO v_already FROM teams WHERE id = p_team_id;
  IF v_already IS NULL THEN
    RAISE EXCEPTION 'Team % not found', p_team_id;
  END IF;
  IF v_already IS NOT DISTINCT FROM p_phase_id THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'phaseId', p_phase_id);
  END IF;

  -- 2a. Archive the previous phase's roster so the new auction starts empty.
  -- available_from = now() (no inter-phase cooldown; the market is fresh each phase).
  UPDATE contracts
     SET status = 'released',
         released_at = now(),
         available_from = now()
   WHERE team_id = p_team_id
     AND status IN ('active', 'notice');

  -- 2b. Flat budget reset + mark phase confirmed.
  UPDATE teams
     SET treasury = v_budget,
         phase_confirmed_id = p_phase_id,
         phase_confirmed_at = now()
   WHERE id = p_team_id;

  -- 2c. Audit line.
  INSERT INTO treasury_log (team_id, type, amount, description)
  VALUES (p_team_id, 'budget_reset', v_budget,
          'Classic budget reset — ' || p_phase_label);

  RETURN jsonb_build_object('ok', true, 'skipped', false,
                            'phaseId', p_phase_id, 'budget', v_budget);
END;
$$;

GRANT EXECUTE ON FUNCTION public.classic_phase_reset(uuid, int, text)
  TO authenticated, service_role;
