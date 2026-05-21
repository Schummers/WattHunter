-- Make credit_sponsor_bonuses idempotent.
--
-- Defensive backstop: even though sponsor_bonus.py now filters out
-- already-credited bonuses before calling this RPC (commit landed
-- alongside this migration), we belt-and-suspenders the RPC itself
-- so that future callers or pipeline reruns cannot double-credit.
--
-- Idempotence key: (team_id, type='sponsor_bonus', rider_id, description).
-- Descriptions are deterministic for a given (race_slug, result_type, rank,
-- multiplier) combination, so they uniquely identify a logical bonus.
--
-- If a matching row already exists in treasury_log, the entry is skipped
-- (no treasury_log insert, no treasury credit). The return payload reports
-- both `entries` (processed) and `skipped` for observability.

CREATE OR REPLACE FUNCTION public.credit_sponsor_bonuses(
  p_team_id    uuid,
  p_bonuses    jsonb   -- [{amount, rider_id, description}, ...]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total      bigint := 0;
  v_count      int := 0;
  v_skipped    int := 0;
  v_entry      jsonb;
  v_amount     int;
  v_rider_id   uuid;
  v_descr      text;
BEGIN
  IF p_bonuses IS NULL OR jsonb_array_length(p_bonuses) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'credited', 0, 'entries', 0, 'skipped', 0);
  END IF;

  -- Lock team row to prevent concurrent treasury mutations
  PERFORM 1 FROM public.teams WHERE id = p_team_id FOR UPDATE;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_bonuses)
  LOOP
    v_amount   := (v_entry->>'amount')::int;
    v_rider_id := NULLIF(v_entry->>'rider_id', '')::uuid;
    v_descr    := v_entry->>'description';

    -- Skip invalid entries (NULL, zero, or negative amounts)
    IF v_amount IS NULL OR v_amount <= 0 THEN
      CONTINUE;
    END IF;

    -- Idempotence: skip if an identical sponsor_bonus row already exists
    IF EXISTS (
      SELECT 1
      FROM public.treasury_log
      WHERE team_id    = p_team_id
        AND type       = 'sponsor_bonus'
        AND rider_id   IS NOT DISTINCT FROM v_rider_id
        AND description = v_descr
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.treasury_log (team_id, type, amount, description, rider_id)
    VALUES (p_team_id, 'sponsor_bonus', v_amount, v_descr, v_rider_id);

    v_total := v_total + v_amount;
    v_count := v_count + 1;
  END LOOP;

  -- Atomic relative treasury credit (only what was actually inserted)
  IF v_total > 0 THEN
    UPDATE public.teams
    SET treasury = treasury + v_total
    WHERE id = p_team_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'credited', v_total,
    'entries', v_count,
    'skipped', v_skipped
  );
END;
$$;

-- Permissions: keep service_role only (matches 20260520000003 + 20260520000004)
REVOKE EXECUTE ON FUNCTION public.credit_sponsor_bonuses(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_sponsor_bonuses(uuid, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.credit_sponsor_bonuses(uuid, jsonb) TO service_role;

-- Supporting index for the idempotence EXISTS lookup
-- (cheap on a small table; matches the rare case where the same description
-- is checked across many rows for the same team).
CREATE INDEX IF NOT EXISTS idx_treasury_log_sponsor_bonus_dedup
  ON public.treasury_log (team_id, description)
  WHERE type = 'sponsor_bonus';
