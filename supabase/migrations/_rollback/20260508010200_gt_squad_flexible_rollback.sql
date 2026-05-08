-- supabase/migrations/_rollback/20260508010200_gt_squad_flexible_rollback.sql
DROP TRIGGER IF EXISTS gt_squad_clear_role_on_remove ON gt_squad;
DROP TRIGGER IF EXISTS gt_squad_cap_at_8 ON gt_squad;
DROP FUNCTION IF EXISTS clear_role_on_squad_remove();
DROP FUNCTION IF EXISTS enforce_gt_squad_cap();
DROP POLICY IF EXISTS gt_squad_delete ON gt_squad;
DROP POLICY IF EXISTS gt_squad_insert ON gt_squad;
-- Note: cannot trivially restore previous policies (their content depends on
-- the prior migration history); operators rolling back should manually verify
-- the state of gt_squad RLS policies matches their expectations.
