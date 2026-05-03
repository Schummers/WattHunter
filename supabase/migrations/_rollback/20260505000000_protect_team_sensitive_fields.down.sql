DROP TRIGGER IF EXISTS teams_protect_sensitive_fields ON public.teams;
DROP FUNCTION IF EXISTS public.block_team_field_updates();
