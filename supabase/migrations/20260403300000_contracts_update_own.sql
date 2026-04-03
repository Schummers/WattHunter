-- Fix bug #18: contracts table has no UPDATE RLS policy, so releaseRider silently fails.
-- Allow a team owner to update their own contracts (needed for release).

create policy "contracts_update_own" on public.contracts
  for update using (
    exists (
      select 1 from public.teams t
      where t.id = team_id and t.user_id = auth.uid()
    )
  );
