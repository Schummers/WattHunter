-- Fix: trigger WHEN clause was blocking SECURITY DEFINER RPCs because
-- current_setting('role') stays 'authenticated' even inside SECURITY DEFINER.
-- Add current_user check: postgres-owned RPCs run as 'postgres' user.
DROP TRIGGER IF EXISTS teams_protect_sensitive_fields ON public.teams;

CREATE TRIGGER teams_protect_sensitive_fields
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  WHEN (
    current_setting('role', true) <> ALL (ARRAY['service_role', 'supabase_admin'])
    AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
  )
  EXECUTE FUNCTION block_team_field_updates();
