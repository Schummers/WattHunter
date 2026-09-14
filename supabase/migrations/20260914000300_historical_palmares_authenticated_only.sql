-- The historical palmares is the private history of one group of friends, with
-- their real account names. The first migration opened it to `anon`, which means
-- the public demo league could read it — and the demo is the try-before-signup
-- shop window.
--
-- Narrowed to signed-in accounts. Nothing else about the tables changes.

drop policy if exists historical_tours_select_all on public.historical_tours;
drop policy if exists historical_tours_select_authenticated on public.historical_tours;
create policy historical_tours_select_authenticated on public.historical_tours
  for select
  to authenticated
  using (true);

drop policy if exists historical_results_select_all on public.historical_results;
drop policy if exists historical_results_select_authenticated on public.historical_results;
create policy historical_results_select_authenticated on public.historical_results
  for select
  to authenticated
  using (true);

revoke select on public.historical_tours from anon;
revoke select on public.historical_results from anon;
