-- Fix infinite recursion in league_members and teams policies.
-- The old league_members_select policy queries league_members itself, causing recursion.
-- Solution: SECURITY DEFINER function bypasses RLS for membership checks.

create or replace function public.is_league_member(p_league_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid()
  );
$$;

-- Drop recursive policies
drop policy if exists "league_members_select" on public.league_members;
drop policy if exists "teams_select_league" on public.teams;

-- Recreate with the security definer function
create policy "league_members_select" on public.league_members
  for select using (public.is_league_member(league_id));

create policy "teams_select_league" on public.teams
  for select using (public.is_league_member(league_id));
