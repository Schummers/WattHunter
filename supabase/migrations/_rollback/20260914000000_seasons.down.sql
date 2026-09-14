drop trigger if exists leagues_ensure_season on public.leagues;
drop function if exists public.ensure_season();
drop function if exists public.season_player_xp(integer);
alter table public.leagues drop constraint if exists leagues_season_year_fkey;
drop index if exists public.idx_leagues_season_year;
drop table if exists public.seasons;
