-- Migration: sponsors rework — 6 tiers, 13 sponsors, bonus-based model
-- Created: 2026-04-02
-- Drops old sponsors/team_sponsors system, recreates with orientation + bonus columns
-- Adds sponsor_bonuses table for race result bonuses
-- Updates treasury_log check constraint with new types
-- Drops revenue_earned from rider_xp_daily (replaced by sponsor_bonuses)

-- ---------------------------------------------------------------------------
-- 1. Drop old sponsor system (cascade drops dependent data)
-- ---------------------------------------------------------------------------
drop table if exists public.team_sponsors cascade;
drop table if exists public.sponsors cascade;

-- ---------------------------------------------------------------------------
-- 2. sponsors — 13 real cycling sponsors with tier/bonus model
-- ---------------------------------------------------------------------------
create table public.sponsors (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null unique,
  slug                    text not null unique,
  tier                    int not null check (tier between 1 and 6),
  unlock_level            int not null check (unlock_level between 1 and 8),
  monthly_budget          int not null,
  orientation             text not null check (orientation in ('gc', 'one_day', 'neutral')),
  nationality             text,
  bonus_gc                int not null default 0,
  bonus_one_day           int not null default 0,
  bonus_stage             int not null default 0,
  gc_threshold            int not null default 0,
  one_day_threshold       int not null default 0,
  stage_threshold         int not null default 0,
  has_explicit_prestige   boolean not null default false,
  bonus_monument          int,
  bonus_grand_tour        int,
  monument_threshold      int,
  grand_tour_threshold    int,
  sort_order              int not null default 0,
  created_at              timestamptz not null default now()
);

alter table public.sponsors enable row level security;

create policy "Sponsors readable by all"
  on public.sponsors for select using (true);

-- ---------------------------------------------------------------------------
-- 3. Seed 13 sponsors
-- ---------------------------------------------------------------------------
insert into public.sponsors (
  name, slug, tier, unlock_level, monthly_budget,
  orientation, nationality,
  bonus_gc, bonus_one_day, bonus_stage,
  gc_threshold, one_day_threshold, stage_threshold,
  has_explicit_prestige,
  bonus_monument, bonus_grand_tour,
  monument_threshold, grand_tour_threshold,
  sort_order
) values
  -- Tier 1 — Level 1
  ('Lotto',                'lotto',      1, 1,  250000, 'neutral', null,
   3000,  3000,  2000, 25, 25, 10, false, null, null, null, null, 10),

  -- Tier 2 — Level 2
  ('Astana',               'astana',     2, 2,  350000, 'neutral', null,
   5000,  5000,  3000, 20, 20, 10, false, null, null, null, null, 20),

  -- Tier 3 — Level 3
  ('Groupama-FDJ',         'groupama',   3, 3,  450000, 'gc',      'FR',
   20000, 5000,  5000, 15, 15,  5, false, null, null, null, null, 30),

  ('Movistar',             'movistar',   3, 3,  450000, 'gc',      'ES',
   20000, 5000,  5000, 15, 15,  5, false, null, null, null, null, 31),

  ('Alpecin-Deceuninck',   'alpecin',    3, 3,  450000, 'one_day', 'BE/NL',
   5000, 10000,  5000, 15, 15,  5, false, null, null, null, null, 32),

  ('Uno-X',                'unox',       3, 3,  450000, 'one_day', 'DK/NO',
   5000, 10000,  5000, 15, 15,  5, false, null, null, null, null, 33),

  -- Tier 4 — Level 5
  ('Ineos Grenadiers',     'ineos',      4, 5,  650000, 'gc',      'GB',
   40000, 10000, 10000, 10, 10,  3, false, null, null, null, null, 40),

  ('Decathlon AG2R',       'decathlon',  4, 5,  650000, 'gc',      'FR',
   40000, 10000, 10000, 10, 10,  3, false, null, null, null, null, 41),

  ('Soudal Quick-Step',    'soudal',     4, 5,  650000, 'one_day', 'BE',
   10000, 20000, 10000, 10, 10,  3, false, null, null, null, null, 42),

  ('Lidl-Trek',            'lidl-trek',  4, 5,  650000, 'one_day', 'US/IT',
   10000, 20000, 10000, 10, 10,  3, false, null, null, null, null, 43),

  -- Tier 5 — Level 7 (prestige)
  ('Visma-Lease a Bike',   'visma',      5, 7, 1000000, 'gc',      null,
   25000, 25000, 15000,  5,  5,  1, true, 75000, 75000, 3, 3, 50),

  ('Red Bull-Bora',        'redbull-bora', 5, 7, 1000000, 'gc',   null,
   30000, 30000, 15000,  5,  5,  1, true, 50000, 50000, 5, 5, 51),

  -- Tier 6 — Level 8 (prestige)
  ('UAE Team Emirates',    'uae',        6, 8, 1250000, 'neutral', null,
   50000, 50000, 25000,  1,  1,  1, true, 100000, 100000, 3, 3, 60);

-- ---------------------------------------------------------------------------
-- 4. team_sponsors — one sponsor per team (simplified)
-- ---------------------------------------------------------------------------
create table public.team_sponsors (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  sponsor_id   uuid not null references public.sponsors(id) on delete restrict,
  activated_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique(team_id)
);

alter table public.team_sponsors enable row level security;

create policy "Team sponsors readable by all"
  on public.team_sponsors for select using (true);

create policy "Team sponsors writable by team owner"
  on public.team_sponsors for all to authenticated
  using (team_id in (select id from public.teams where user_id = auth.uid()))
  with check (team_id in (select id from public.teams where user_id = auth.uid()));

-- Auto-assign Lotto for existing teams without a sponsor (level <= 2 or any level)
insert into public.team_sponsors (team_id, sponsor_id)
select
  t.id,
  s.id
from public.teams t
cross join public.sponsors s
where s.slug = 'lotto'
  and t.id not in (select team_id from public.team_sponsors)
on conflict (team_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. sponsor_bonuses — per-race result bonuses
-- ---------------------------------------------------------------------------
create table public.sponsor_bonuses (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  sponsor_id   uuid not null references public.sponsors(id) on delete restrict,
  rider_id     uuid not null references public.riders(id) on delete restrict,
  race_slug    text not null,
  race_date    date not null,
  result_type  text not null check (result_type in ('gc', 'one_day', 'monument', 'grand_tour', 'stage')),
  rider_rank   int not null,
  base_bonus   int not null,
  multiplier   numeric(3,1) not null default 1.0,
  final_bonus  int not null,
  created_at   timestamptz not null default now()
);

alter table public.sponsor_bonuses enable row level security;

create policy "Sponsor bonuses readable by all"
  on public.sponsor_bonuses for select using (true);

-- Index: team_id + race_date for efficient lookups
create index idx_sponsor_bonuses_team_race_date
  on public.sponsor_bonuses (team_id, race_date);

-- Unique dedup: one bonus per team/rider/race/result_type
create unique index idx_sponsor_bonuses_dedup
  on public.sponsor_bonuses (team_id, rider_id, race_slug, result_type);

-- ---------------------------------------------------------------------------
-- 6. Update treasury_log check constraint — add new types
-- ---------------------------------------------------------------------------
alter table public.treasury_log
  drop constraint if exists treasury_log_type_check;

alter table public.treasury_log
  add constraint treasury_log_type_check
  check (type in (
    'starting_fund',
    'auction_purchase',
    'monthly_salary',
    'rider_revenue',
    'sponsor_payment',
    'bankruptcy_release',
    'monthly_bonus',
    'daily_salary',
    'daily_sponsor_base',
    'sponsor_bonus'
  ));

-- ---------------------------------------------------------------------------
-- 7. Drop revenue_earned from rider_xp_daily (replaced by sponsor_bonuses)
-- ---------------------------------------------------------------------------
alter table public.rider_xp_daily
  drop column if exists revenue_earned;
