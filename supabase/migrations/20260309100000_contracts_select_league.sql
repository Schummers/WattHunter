-- Allow league members to read contracts of all teams in their league.
-- Needed so the recruts page can exclude riders owned by any league team.

create policy "contracts_select_league" on public.contracts
  for select using (
    exists (
      select 1 from public.teams t
      join public.league_members lm on lm.league_id = t.league_id
      where t.id = contracts.team_id
        and lm.user_id = auth.uid()
    )
  );
