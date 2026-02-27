-- Allow the league commissioner to create auctions.
-- Also allow league members to select auctions (covers the RETURNING case after insert).
create policy "auctions_insert_commissioner" on public.auctions
  for insert with check (
    exists (
      select 1 from public.leagues l
      where l.id = league_id and l.commissioner_id = auth.uid()
    )
  );

-- Also allow the commissioner to update auctions (e.g. status changes).
create policy "auctions_update_commissioner" on public.auctions
  for update using (
    exists (
      select 1 from public.leagues l
      where l.id = league_id and l.commissioner_id = auth.uid()
    )
  );
