-- Fix rider_xp_daily RLS: allow reading XP for all teams in leagues the user belongs to
-- Previously restricted to own team only, which broke the Riders Ranking view

DROP POLICY IF EXISTS "rider_xp_daily_select_own" ON public.rider_xp_daily;

CREATE POLICY "rider_xp_daily_select_league" ON public.rider_xp_daily
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.teams t
      JOIN public.league_members lm ON lm.league_id = t.league_id
      WHERE t.id = rider_xp_daily.team_id
        AND lm.user_id = auth.uid()
    )
  );
