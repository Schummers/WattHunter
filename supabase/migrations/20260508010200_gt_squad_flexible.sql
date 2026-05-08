-- supabase/migrations/20260508010200_gt_squad_flexible.sql
-- Allow squad changes during active GT phase, capped at 8 riders.
-- Cutoff: changes after 11:00 CET apply to the next stage (enforced
-- in the same way as gt_role_assignments).

-- Drop any existing INSERT/DELETE policy that restricts to phase init.
DROP POLICY IF EXISTS gt_squad_insert ON gt_squad;
DROP POLICY IF EXISTS gt_squad_delete ON gt_squad;

-- New policies: team owner can INSERT/DELETE during the active phase
CREATE POLICY gt_squad_insert ON gt_squad
  FOR INSERT
  WITH CHECK (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

CREATE POLICY gt_squad_delete ON gt_squad
  FOR DELETE
  USING (
    team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

-- Cap-at-8 trigger
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
    AND year = NEW.year;
  IF current_size >= 8 THEN
    RAISE EXCEPTION 'GT squad already at max (8 riders)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER gt_squad_cap_at_8
  BEFORE INSERT ON gt_squad
  FOR EACH ROW
  EXECUTE FUNCTION enforce_gt_squad_cap();

-- When a rider is removed from the squad, also clear their role
-- (so a re-add starts fresh as domestique).
CREATE OR REPLACE FUNCTION clear_role_on_squad_remove()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO gt_role_assignments(team_id, phase_id, year, rider_id, role, applied_at)
  VALUES (OLD.team_id, OLD.phase_id, OLD.year, OLD.rider_id, 'domestique', now());
  RETURN OLD;
END;
$$;

CREATE TRIGGER gt_squad_clear_role_on_remove
  AFTER DELETE ON gt_squad
  FOR EACH ROW
  EXECUTE FUNCTION clear_role_on_squad_remove();
