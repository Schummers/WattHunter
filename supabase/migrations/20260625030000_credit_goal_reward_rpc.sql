-- Atomic, idempotent goal-reward payout (audit 2026-06-11, findings B2-01 / B2-02 / DATA-1).
--
-- BEFORE: goal_evaluator.py inserted the sponsor_goal_completions row in one
-- try/except, then credited treasury in a SEPARATE try/except via a non-atomic
-- read-modify-write (SELECT treasury → UPDATE treasury = current + reward).
-- Two failure modes:
--   1. Money LOSS: if the completion insert succeeds but the credit step fails
--      (transient error between the two blocks), the completion is recorded, so
--      the next run's idempotency guard skips it → the reward is never paid.
--   2. Lost update: the SELECT-then-UPDATE is not atomic; concurrent writers can
--      clobber each other's treasury delta.
--
-- AFTER: a single SECURITY DEFINER function does the completion insert + the
-- treasury_log audit row + the relative treasury credit in ONE transaction.
-- `ON CONFLICT (team_id, sponsor_id, goal_key, race_slug) DO NOTHING` makes a
-- rerun a no-op (idempotent), and the credit only runs when a row was actually
-- inserted. Either everything commits or nothing does — no partial payout.
--
-- Modeled on credit_sponsor_bonuses (20260521120100): same lock-row + relative
-- credit + service_role-only pattern.

CREATE OR REPLACE FUNCTION public.credit_goal_reward(
  p_completion jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team_id  uuid := (p_completion->>'team_id')::uuid;
  v_final    int  := (p_completion->>'final_reward')::int;
  v_rider_id uuid := NULLIF(p_completion->>'rider_id', '')::uuid;
  v_inserted int;
BEGIN
  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'credit_goal_reward: team_id is required';
  END IF;

  -- Lock the team row for the duration of the transaction.
  PERFORM 1 FROM public.teams WHERE id = v_team_id FOR UPDATE;

  -- Insert the completion. ON CONFLICT makes a rerun a no-op (idempotent on the
  -- same logical goal), so the credit below cannot double-pay.
  INSERT INTO public.sponsor_goal_completions (
    team_id, sponsor_id, goal_index, goal_label, race_slug, stage_slug,
    rider_id, base_reward, multiplier, final_reward, goal_key,
    neutralized_stage_slugs
  ) VALUES (
    v_team_id,
    (p_completion->>'sponsor_id')::uuid,
    (p_completion->>'goal_index')::int,
    p_completion->>'goal_label',
    p_completion->>'race_slug',
    NULLIF(p_completion->>'stage_slug', ''),
    v_rider_id,
    (p_completion->>'base_reward')::int,
    (p_completion->>'multiplier')::numeric,
    v_final,
    p_completion->>'goal_key',
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_completion->'neutralized_stage_slugs')),
      '{}'::text[]
    )
  )
  ON CONFLICT (team_id, sponsor_id, goal_key, race_slug) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Already credited on a previous run → no-op, no double payout.
  IF v_inserted = 0 THEN
    RETURN jsonb_build_object('ok', true, 'credited', 0, 'skipped', 1);
  END IF;

  -- Audit row + atomic relative credit, in the SAME transaction as the insert.
  INSERT INTO public.treasury_log (team_id, type, amount, description, rider_id)
  VALUES (
    v_team_id,
    'gt_goal_bonus',
    v_final,
    p_completion->>'description',
    v_rider_id
  );

  UPDATE public.teams
  SET treasury = treasury + v_final
  WHERE id = v_team_id;

  RETURN jsonb_build_object('ok', true, 'credited', v_final, 'skipped', 0);
END;
$$;

-- service_role only (pipeline runs with the service key); never reachable from anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.credit_goal_reward(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_goal_reward(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.credit_goal_reward(jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.credit_goal_reward(jsonb) TO service_role;
