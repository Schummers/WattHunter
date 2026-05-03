-- Trigger: block direct UPDATE on teams sensitive fields via anon/authenticated role.
-- SECURITY DEFINER functions (RPCs) run as the function owner (postgres/service_role),
-- so they bypass this trigger automatically.

CREATE OR REPLACE FUNCTION public.block_team_field_updates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.level IS DISTINCT FROM OLD.level
     OR NEW.treasury IS DISTINCT FROM OLD.treasury
     OR NEW.cumulative_xp IS DISTINCT FROM OLD.cumulative_xp
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.league_id IS DISTINCT FROM OLD.league_id
  THEN
    RAISE EXCEPTION 'Protected field: level/treasury/xp/user_id/league_id can only be modified by SECURITY DEFINER functions';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER teams_protect_sensitive_fields
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  WHEN (current_setting('role', true) NOT IN ('service_role', 'supabase_admin'))
  EXECUTE FUNCTION public.block_team_field_updates();
