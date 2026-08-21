-- "Has every team in this league filled its squad?" in one round trip.
--
-- Resolution asks this to decide whether opening the next round would serve any
-- purpose. Doing it from TypeScript meant fetching the members then calling
-- team_is_complete once per team, an N+1 on the hot path of every round close.
--
-- Empty leagues answer false: a league with no members has not "finished", and
-- returning true there would end the phase on a technicality.

CREATE OR REPLACE FUNCTION public.league_all_teams_complete(p_league_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM league_members WHERE league_id = p_league_id
  ) AND NOT EXISTS (
    SELECT 1
      FROM league_members lm
     WHERE lm.league_id = p_league_id
       AND NOT public.team_is_complete(lm.team_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.league_all_teams_complete(uuid)
  TO authenticated, service_role;
