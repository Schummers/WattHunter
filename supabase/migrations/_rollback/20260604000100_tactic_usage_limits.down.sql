-- Restore the inline-CASE trigger body from migration 20260508010100,
-- then drop the new table + helper.

CREATE OR REPLACE FUNCTION public.enforce_tactic_usage_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INT;
  max_allowed   INT;
BEGIN
  max_allowed := CASE NEW.tactic_type
    WHEN 'unleash'         THEN 2
    WHEN 'overdrive'       THEN 2
    WHEN 'call_the_bus'    THEN 3
    WHEN 'nemesis_gc'      THEN 1
    WHEN 'nemesis_sprint'  THEN 1
    ELSE NULL
  END;

  IF max_allowed IS NULL THEN
    RAISE EXCEPTION 'unknown tactic_type: %', NEW.tactic_type
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*) INTO current_count
  FROM public.gt_tactic_activations
  WHERE team_id = NEW.team_id
    AND phase_id = NEW.phase_id
    AND year = NEW.year
    AND tactic_type = NEW.tactic_type;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'tactic % already used % time(s) (max %)',
      NEW.tactic_type, current_count, max_allowed
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.infer_race_kind(TEXT, INT);
DROP TABLE IF EXISTS public.tactic_usage_limits;
