-- The trigger WHEN clause checked current_setting('role') only, which stays
-- 'authenticated' even inside SECURITY DEFINER functions. Add current_user
-- check so postgres-owned SECURITY DEFINER RPCs can update sensitive fields.
DROP TRIGGER IF EXISTS teams_protect_sensitive_fields ON public.teams;

CREATE TRIGGER teams_protect_sensitive_fields
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  WHEN (
    current_setting('role', true) <> ALL (ARRAY['service_role', 'supabase_admin'])
    AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
  )
  EXECUTE FUNCTION block_team_field_updates();
