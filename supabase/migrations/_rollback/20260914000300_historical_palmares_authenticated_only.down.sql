drop policy if exists historical_tours_select_authenticated on public.historical_tours;
drop policy if exists historical_results_select_authenticated on public.historical_results;
create policy historical_tours_select_all on public.historical_tours
  for select to anon, authenticated using (true);
create policy historical_results_select_all on public.historical_results
  for select to anon, authenticated using (true);
grant select on public.historical_tours to anon;
grant select on public.historical_results to anon;
