-- Ticket 01 — Season entity and league attachment.
--
-- A season is a year. `leagues.season_year` already carried that year as a loose
-- integer; this migration promotes it into a real entity and attaches every
-- league to it through a foreign key. No XP row is rewritten, no league column
-- is added: the attachment is the constraint, the aggregation happens at read
-- time, BY PLAYER and not by team, since a team name changes every season.

create table if not exists public.seasons (
  -- Natural primary key: a season IS a year. A surrogate id would only add a
  -- join between two things that are already the same value.
  year integer primary key,
  created_at timestamptz not null default now(),
  constraint seasons_year_plausible check (year between 2000 and 2100)
);

comment on table public.seasons is
  'One row per played season. A season equals a calendar year; leagues attach to it through leagues.season_year.';

-- Backfill from what exists before the FK can be created: every year already
-- referenced by a league, which today is 2026 only.
insert into public.seasons (year)
select distinct l.season_year
from public.leagues l
on conflict (year) do nothing;

-- Keep the current season available even in a database with no league yet
-- (a fresh `supabase db reset` seeds nothing).
insert into public.seasons (year)
values (extract(year from now())::integer)
on conflict (year) do nothing;

alter table public.leagues
  drop constraint if exists leagues_season_year_fkey;

alter table public.leagues
  add constraint leagues_season_year_fkey
  foreign key (season_year) references public.seasons (year)
  on update cascade
  on delete restrict;

-- Postgres does not index a foreign key column on its own, and every season
-- query filters on it.
create index if not exists idx_leagues_season_year on public.leagues (season_year);

alter table public.seasons enable row level security;

-- A list of years is public reference data: no ownership, nothing to leak.
drop policy if exists seasons_select_all on public.seasons;
create policy seasons_select_all on public.seasons
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policy: seasons are created by migrations only.
grant select on public.seasons to anon, authenticated;

-- Cumulative XP of a season, by player, all leagues of that season merged.
--
-- BY PLAYER: the two 2026 classic leagues (V1 carried the Classics and the Giro,
-- V2 the Tour and the Vuelta) are the same group of people under two team names,
-- so the sum has to key on the account, never on the team.
--
-- No duplicate when a player owns a team in each league: `league_members` is
-- unique on (league_id, user_id), so a team joins exactly one member row, and
-- the two teams of a same player add up instead of multiplying.
--
-- SECURITY INVOKER on purpose: the caller sees the leagues they are a member of,
-- nothing more. The historical archive (ticket 06) reads through its own path.
create or replace function public.season_player_xp(p_season_year integer)
returns table (
  user_id uuid,
  display_name text,
  xp numeric,
  team_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    lm.user_id,
    max(u.display_name) as display_name,
    coalesce(sum(t.cumulative_xp), 0) as xp,
    count(distinct t.id)::integer as team_count
  from public.teams t
  join public.leagues l on l.id = t.league_id
  join public.league_members lm on lm.team_id = t.id
  join public.users u on u.id = lm.user_id
  where l.season_year = p_season_year
  group by lm.user_id
  order by coalesce(sum(t.cumulative_xp), 0) desc;
$$;

comment on function public.season_player_xp(integer) is
  'Cumulative XP of a season by player, all leagues of that season merged. Keys on the account, not the team.';

grant execute on function public.season_player_xp(integer) to anon, authenticated;

-- `leagues.season_year` defaults to the current year, so the first league created
-- on January 1st of the next season would hit the foreign key and fail. The
-- season is opened on demand instead: the FK stays a real constraint, and
-- creating a league never breaks on a calendar boundary.
create or replace function public.ensure_season()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.seasons (year)
  values (new.season_year)
  on conflict (year) do nothing;
  return new;
end;
$$;

revoke execute on function public.ensure_season() from public, anon, authenticated;

drop trigger if exists leagues_ensure_season on public.leagues;
create trigger leagues_ensure_season
  before insert or update of season_year on public.leagues
  for each row
  execute function public.ensure_season();
