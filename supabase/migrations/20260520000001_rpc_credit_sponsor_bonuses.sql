-- Atomic treasury credit for sponsor bonuses.
-- Replaces the per-bonus read-modify-write pattern in sponsor_bonus.py
-- with a single RPC call per team (same pattern as confirm_phase_setup).

CREATE OR REPLACE FUNCTION public.credit_sponsor_bonuses(
  p_team_id    uuid,
  p_bonuses    jsonb   -- [{amount, rider_id, description}, ...]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total     bigint := 0;
  v_count     int := 0;
  v_entry     jsonb;
  v_amount    int;
BEGIN
  IF p_bonuses IS NULL OR jsonb_array_length(p_bonuses) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'credited', 0, 'entries', 0);
  END IF;

  -- Lock team row to prevent concurrent treasury mutations
  PERFORM 1 FROM public.teams WHERE id = p_team_id FOR UPDATE;

  -- Insert one treasury_log row per bonus (preserves per-rider audit trail)
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_bonuses)
  LOOP
    v_amount := (v_entry->>'amount')::int;

    -- Skip invalid entries (NULL, zero, or negative amounts)
    IF v_amount IS NULL OR v_amount <= 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.treasury_log (team_id, type, amount, description, rider_id)
    VALUES (
      p_team_id,
      'sponsor_bonus',
      v_amount,
      v_entry->>'description',
      (v_entry->>'rider_id')::uuid
    );
    v_total := v_total + v_amount;
    v_count := v_count + 1;
  END LOOP;

  -- Atomic relative treasury credit (no read-modify-write race condition)
  UPDATE public.teams
  SET treasury = treasury + v_total
  WHERE id = p_team_id;

  RETURN jsonb_build_object('ok', true, 'credited', v_total, 'entries', v_count);
END;
$$;

-- Restrict to service_role only (Python pipeline). PG grants EXECUTE to PUBLIC by default.
REVOKE EXECUTE ON FUNCTION public.credit_sponsor_bonuses(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_sponsor_bonuses(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_sponsor_bonuses(uuid, jsonb) TO service_role;
