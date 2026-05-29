-- Remove the old 1-arg overload now that all callers pass p_team_name.
-- Otherwise PostgREST routes 1-arg calls to the legacy hardcoded-'My Team' version.
DROP FUNCTION IF EXISTS public.join_league_by_code(text);
