-- Allow commissioner to read their own league (needed for insert...select and before league_members exists)
create policy "leagues_select_commissioner" on public.leagues for select using (auth.uid() = commissioner_id);
