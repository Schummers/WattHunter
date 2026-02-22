-- Change max_players: default 20, max 20, no min constraint on league size
alter table public.leagues drop constraint if exists leagues_max_players_check;
alter table public.leagues alter column max_players set default 20;
alter table public.leagues add constraint leagues_max_players_check check (max_players between 1 and 20);

-- Update existing leagues to 20 if they had the old default
update public.leagues set max_players = 20 where max_players between 6 and 12;
