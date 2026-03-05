-- Migration: race_results, rider_season_rankings, race_startlists
-- Created: 2026-03-05

-- ---------------------------------------------------------------------------
-- race_results — points earned per rider per race/stage
-- ---------------------------------------------------------------------------
create table public.race_results (
  id          uuid primary key default gen_random_uuid(),
  rider_id    uuid not null references public.riders(id) on delete cascade,
  race_slug   text not null,       -- "race/paris-nice/2026/stage-3"
  race_name   text not null,       -- "Paris-Nice - Stage 3"
  stage       text,                -- "stage-3" or NULL for one-day races
  race_date   date not null,
  pcs_points  int not null default 0,
  rank        int,
  created_at  timestamptz not null default now(),
  unique(rider_id, race_slug)
);

alter table public.race_results enable row level security;

create policy "Anyone can read race_results"
  on public.race_results
  for select
  using (true);

-- ---------------------------------------------------------------------------
-- rider_season_rankings — PCS ranking per season (historical)
-- ---------------------------------------------------------------------------
create table public.rider_season_rankings (
  rider_id    uuid not null references public.riders(id) on delete cascade,
  season      int not null,        -- 2024, 2025, 2026
  points      int not null default 0,
  rank        int,
  created_at  timestamptz not null default now(),
  primary key (rider_id, season)
);

alter table public.rider_season_rankings enable row level security;

create policy "Anyone can read rider_season_rankings"
  on public.rider_season_rankings
  for select
  using (true);

-- ---------------------------------------------------------------------------
-- race_startlists — upcoming race participation per rider
-- ---------------------------------------------------------------------------
create table public.race_startlists (
  rider_id    uuid not null references public.riders(id) on delete cascade,
  race_slug   text not null,       -- "race/paris-nice/2026"
  race_name   text not null,       -- "Paris-Nice"
  race_date   date not null,
  created_at  timestamptz not null default now(),
  primary key (rider_id, race_slug)
);

alter table public.race_startlists enable row level security;

create policy "Anyone can read race_startlists"
  on public.race_startlists
  for select
  using (true);
