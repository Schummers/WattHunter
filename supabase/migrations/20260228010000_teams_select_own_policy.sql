-- Fix: allow users to SELECT their own team rows.
-- Without this, the INSERT ... RETURNING used by the Supabase client
-- fails because teams_select_league requires league membership,
-- which doesn't exist yet at team-creation time (chicken-and-egg).

create policy "teams_select_own" on public.teams
  for select using (auth.uid() = user_id);
