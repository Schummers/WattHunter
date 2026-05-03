DROP FUNCTION IF EXISTS public.join_league_by_code(text);
DROP POLICY IF EXISTS "leagues_select_member_or_commissioner" ON public.leagues;
CREATE POLICY "leagues_select_authenticated" ON public.leagues
  FOR SELECT USING (auth.uid() IS NOT NULL);
