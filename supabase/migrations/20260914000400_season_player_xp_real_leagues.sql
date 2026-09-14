-- `season_player_xp` counted EVERY league of the year, which in production meant
-- the demo league and a never-launched test league.
--
-- Measured on the 2026 season before the fix: the demo added 7 987 XP and eight
-- fictional players (Flamme Rouge, Les Grimpeurs…) to the group's own standing,
-- and one player came out with three teams instead of two.
--
-- A season is made of the leagues the group actually played:
--   - not the demo (`is_demo`), which is the public shop window;
--   - not a league still `pending`, which has never been launched.

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
    and l.is_demo = false
    and l.status <> 'pending'
  group by lm.user_id
  order by coalesce(sum(t.cumulative_xp), 0) desc;
$$;

comment on function public.season_player_xp(integer) is
  'Cumulative XP of a season by player, across the leagues the group actually played (no demo, no pending league). Keys on the account, not the team.';
