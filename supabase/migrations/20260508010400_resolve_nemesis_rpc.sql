-- supabase/migrations/20260508010400_resolve_nemesis_rpc.sql
-- Resolves all unresolved nemesis activations for a given stage_slug.
-- Called by the scoring pipeline (service role) — not by clients.

CREATE OR REPLACE FUNCTION resolve_nemesis_for_stage(p_stage_slug TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_act        gt_tactic_activations%ROWTYPE;
  v_attacker   UUID;
  v_target     UUID;
  v_a_rank     INT;
  v_t_rank     INT;
  v_role       TEXT;
  v_outcome    TEXT;
  v_count      INT := 0;
BEGIN
  FOR v_act IN
    SELECT * FROM gt_tactic_activations
    WHERE stage_slug = p_stage_slug
      AND outcome IS NULL
      AND tactic_type IN ('nemesis_gc','nemesis_sprint')
  LOOP
    v_role := CASE v_act.tactic_type
      WHEN 'nemesis_gc' THEN 'gc_leader' ELSE 'sprinter'
    END;

    -- Snapshot role-holder for attacker team at the latest applied_at
    SELECT rider_id INTO v_attacker
    FROM gt_role_assignments
    WHERE team_id = v_act.team_id
      AND phase_id = v_act.phase_id
      AND year = v_act.year
      AND role = v_role
    ORDER BY applied_at DESC
    LIMIT 1;

    -- Same for target team
    SELECT rider_id INTO v_target
    FROM gt_role_assignments
    WHERE team_id = v_act.nemesis_target_team_id
      AND phase_id = v_act.phase_id
      AND year = v_act.year
      AND role = v_role
    ORDER BY applied_at DESC
    LIMIT 1;

    -- If either role unassigned → no_resolution
    IF v_attacker IS NULL OR v_target IS NULL THEN
      UPDATE gt_tactic_activations
      SET outcome = 'no_resolution',
          resolved_at = now(),
          resolved_attacker_rider_id = v_attacker,
          resolved_target_rider_id = v_target
      WHERE id = v_act.id;
      v_count := v_count + 1;
      CONTINUE;
    END IF;

    -- Get stage ranks
    SELECT rank INTO v_a_rank FROM race_results
      WHERE race_slug = p_stage_slug AND rider_id = v_attacker;
    SELECT rank INTO v_t_rank FROM race_results
      WHERE race_slug = p_stage_slug AND rider_id = v_target;

    IF v_a_rank IS NULL OR v_t_rank IS NULL THEN
      v_outcome := 'no_resolution';
    ELSIF v_a_rank < v_t_rank THEN
      v_outcome := 'attacker_won';
    ELSE
      v_outcome := 'target_won';  -- ties favour the defender (spec §6.3)
    END IF;

    UPDATE gt_tactic_activations
    SET outcome = v_outcome,
        resolved_at = now(),
        resolved_attacker_rider_id = v_attacker,
        resolved_target_rider_id = v_target
    WHERE id = v_act.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION resolve_nemesis_for_stage(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_nemesis_for_stage(TEXT) TO service_role;

COMMENT ON FUNCTION resolve_nemesis_for_stage(TEXT) IS
  'Resolve all unresolved Nemesis duels on a given stage. Called by the scoring pipeline. Snapshots role-holders at cutoff into resolved_*_rider_id, compares stage ranks, writes outcome and resolved_at. Ties favour the target.';
