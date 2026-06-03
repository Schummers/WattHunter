-- Spec B (B4) — apply the reversible underdog salary discount at payday.
-- Base: 20260518000003_confirm_phase_setup_remove_late_joiner.sql (latest as of 2026-06-03).
-- The ONLY behavioral change vs that version: the salary deduction loop (step 7) checks
-- v_team.underdog_eligible AND v_contract.underdog_discount to halve the salary.
-- Discount: floor(locked_salary * 0.5 / 1000) * 1000  (1 000 € step, per shipped Spec D).
-- Reversible: when the team climbs out (underdog_eligible = false), the next payday
-- charges full locked_salary again — no change to the contract record.

CREATE OR REPLACE FUNCTION public.confirm_phase_setup(
  p_team_id uuid,
  p_current_phase_id int,
  p_current_phase_label text,
  p_phase_start timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_team record;
  v_strat record;
  v_sponsor record;
  v_income int;
  v_contract record;
  v_total_salary int := 0;
  v_effective_salary int;
  v_desc_suffix text;
BEGIN
  -- 1-2. Fetch team (auth check: either user owns team, or caller is service_role)
  IF v_user_id IS NOT NULL THEN
    SELECT * INTO v_team
    FROM public.teams
    WHERE id = p_team_id AND user_id = v_user_id
    FOR UPDATE;
  ELSE
    SELECT * INTO v_team
    FROM public.teams
    WHERE id = p_team_id
    FOR UPDATE;
  END IF;

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

  -- 6. Credit sponsor income (always use monthly_budget)
  SELECT s.name, s.monthly_budget
  INTO v_sponsor
  FROM public.team_sponsors ts
  JOIN public.sponsors s ON s.id = ts.sponsor_id
  WHERE ts.team_id = p_team_id;

  IF v_sponsor IS NOT NULL THEN
    v_income := v_sponsor.monthly_budget;

    UPDATE public.teams
    SET treasury = treasury + v_income
    WHERE id = p_team_id;

    INSERT INTO public.treasury_log (team_id, type, amount, description)
    VALUES (
      p_team_id,
      'sponsor_payment',
      v_income,
      format('Sponsor income — %s (%s)', v_sponsor.name, p_current_phase_label)
    );
  END IF;

  -- 7. Deduct roster salaries — apply reversible underdog discount.
  -- For a contract with underdog_discount = true AND the team is currently underdog_eligible,
  -- charge floor(locked_salary * 0.5 / 1000) * 1000 (half, rounded down to 1 000 € step).
  -- Full locked_salary is charged otherwise (including when the team has climbed out).
  FOR v_contract IN
    SELECT c.id, c.locked_salary, c.rider_id, c.underdog_discount, r.full_name
    FROM public.contracts c
    JOIN public.riders r ON r.id = c.rider_id
    WHERE c.team_id = p_team_id AND c.status = 'active'
  LOOP
    IF v_team.underdog_eligible AND v_contract.underdog_discount THEN
      v_effective_salary := FLOOR(v_contract.locked_salary * 0.5 / 1000) * 1000;
      v_desc_suffix := ' [underdog -50%]';
    ELSE
      v_effective_salary := v_contract.locked_salary;
      v_desc_suffix := '';
    END IF;

    v_total_salary := v_total_salary + v_effective_salary;

    INSERT INTO public.treasury_log (team_id, rider_id, type, amount, description)
    VALUES (
      p_team_id,
      v_contract.rider_id,
      'payday_salary',
      -v_effective_salary,
      format('Salary — %s (%s)%s', v_contract.full_name, p_current_phase_label, v_desc_suffix)
    );

    UPDATE public.contracts
    SET last_salary_paid = current_date
    WHERE id = v_contract.id;
  END LOOP;

  UPDATE public.teams
  SET treasury = treasury - v_total_salary
  WHERE id = p_team_id;

  -- 8. Mark confirmed
  UPDATE public.teams
  SET phase_confirmed_at = now(),
      phase_confirmed_id = p_current_phase_id
  WHERE id = p_team_id;

  RETURN jsonb_build_object(
    'ok', true,
    'phaseId', p_current_phase_id,
    'phaseLabel', p_current_phase_label,
    'sponsorIncome', COALESCE(v_income, 0),
    'totalSalary', v_total_salary
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_phase_setup(uuid, int, text, timestamptz) TO authenticated, service_role;
