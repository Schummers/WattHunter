-- Allow all authenticated users to read any user's profile.
-- The existing "users_select_own" policy is too restrictive:
-- it prevents seeing other players' display_name and avatar in the lobby.
-- Display name and avatar are not sensitive data.

create policy "users_select_authenticated"
  on public.users
  for select
  using (auth.role() = 'authenticated');
