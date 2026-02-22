-- Allow any authenticated user to read leagues.
-- The invite_code acts as the access barrier (must know the code to join).
-- League data (name, status, max_players) is not sensitive.
create policy "leagues_select_authenticated" on public.leagues
  for select using (auth.uid() is not null);

-- The commissioner-only and member-only SELECT policies are now redundant.
-- Drop them to avoid confusion (the new policy is a superset).
drop policy if exists "leagues_select_member" on public.leagues;
drop policy if exists "leagues_select_commissioner" on public.leagues;
