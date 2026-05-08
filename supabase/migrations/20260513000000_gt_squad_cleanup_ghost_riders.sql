-- Fix GT squad ghost riders: soft-delete orphaned rows, fix cap trigger, add auto-cleanup

-- 1. Soft-delete gt_squad rows for riders without active contracts
UPDATE public.gt_squad
SET removed_at = now()
WHERE removed_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.team_id = gt_squad.team_id
      AND c.rider_id = gt_squad.rider_id
      AND c.status = 'active'
  );

-- 2. Fix enforce_gt_squad_cap to ignore soft-deleted rows
CREATE OR REPLACE FUNCTION enforce_gt_squad_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE current_size INT;
BEGIN
  SELECT COUNT(*) INTO current_size
  FROM gt_squad
  WHERE team_id = NEW.team_id
    AND phase_id = NEW.phase_id
    AND year = NEW.year
    AND removed_at IS NULL;
  IF current_size >= 8 THEN
    RAISE EXCEPTION 'GT squad already at max (8 riders)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Auto-cleanup trigger: when a contract is released, soft-delete from gt_squad
CREATE OR REPLACE FUNCTION auto_cleanup_gt_squad_on_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'released' AND OLD.status = 'active' THEN
    UPDATE public.gt_squad
    SET removed_at = now()
    WHERE rider_id = NEW.rider_id
      AND team_id = NEW.team_id
      AND removed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_gt_squad_on_contract_release
  AFTER UPDATE OF status ON public.contracts
  FOR EACH ROW
  WHEN (NEW.status = 'released' AND OLD.status = 'active')
  EXECUTE FUNCTION auto_cleanup_gt_squad_on_release();
