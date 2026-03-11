-- Migration: sponsors overhaul — 14 real cycling sponsors, slot-based team_sponsors
-- Created: 2026-03-11
-- Drops old generic sponsors system, creates slot-based sponsor marketplace

-- ---------------------------------------------------------------------------
-- Drop old sponsor system
-- ---------------------------------------------------------------------------
drop table if exists public.team_sponsors;
drop table if exists public.sponsors;

-- ---------------------------------------------------------------------------
-- sponsors — 14 real cycling sponsors with eligibility conditions
-- ---------------------------------------------------------------------------
create table public.sponsors (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  abbreviation    text not null,
  tier            int not null check (tier between 1 and 5),
  slot            text not null check (slot in ('secondary', 'principal')),
  monthly_budget  int not null,
  unlock_level    int not null check (unlock_level between 1 and 10),
  nationality     text,
  nationality_count int not null default 0,
  specialty       text[] not null default '{}',
  result_condition text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.sponsors enable row level security;

create policy "Sponsors readable by authenticated"
  on public.sponsors for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- team_sponsors — slot-based, 1 sponsor per slot per team
-- ---------------------------------------------------------------------------
create table public.team_sponsors (
  id                 uuid primary key default gen_random_uuid(),
  team_id            uuid not null references public.teams(id) on delete cascade,
  sponsor_id         uuid not null references public.sponsors(id) on delete restrict,
  slot               text not null check (slot in ('secondary', 'principal')),
  status             text not null default 'active' check (status in ('active', 'pending_change')),
  pending_sponsor_id uuid references public.sponsors(id),
  activated_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique(team_id, slot)
);

alter table public.team_sponsors enable row level security;

create policy "Team sponsors readable by team owner"
  on public.team_sponsors for select to authenticated
  using (team_id in (select id from public.teams where user_id = auth.uid()));

create policy "Team sponsors insertable by team owner"
  on public.team_sponsors for insert to authenticated
  with check (team_id in (select id from public.teams where user_id = auth.uid()));

create policy "Team sponsors updatable by team owner"
  on public.team_sponsors for update to authenticated
  using (team_id in (select id from public.teams where user_id = auth.uid()));

create policy "Team sponsors deletable by team owner"
  on public.team_sponsors for delete to authenticated
  using (team_id in (select id from public.teams where user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Seed 14 sponsors
-- ---------------------------------------------------------------------------
insert into public.sponsors (name, abbreviation, tier, slot, monthly_budget, unlock_level, nationality, nationality_count, specialty, result_condition, sort_order) values
  ('Lotto',             'LOT', 1, 'secondary',  200000, 1, null, 0, '{}',                  null,                  1),
  ('Groupama-FDJ',      'GRP', 2, 'secondary',  350000, 3, 'FR', 2, '{GC}',                null,                  2),
  ('Movistar',          'MOV', 2, 'secondary',  350000, 3, 'ES', 2, '{GC}',                null,                  3),
  ('Uno-X',             'UNX', 2, 'secondary',  350000, 3, 'DK', 2, '{OneDay}',            null,                  4),
  ('Alpecin',           'ALP', 2, 'secondary',  350000, 3, 'BE', 2, '{OneDay,Sprint}',     null,                  5),
  ('Decathlon',         'DEC', 3, 'principal',   550000, 5, 'FR', 2, '{GC,Sprint}',         'top10_stage_race',    6),
  ('Soudal Quick-Step', 'SQS', 3, 'principal',   550000, 5, 'BE', 2, '{OneDay,Sprint}',     'top10_classic',       7),
  ('Ineos Grenadiers',  'INE', 3, 'principal',   550000, 5, 'GB', 2, '{OneDay,GC}',         'top10_stage_race',    8),
  ('Bora-Hansgrohe',    'BOR', 3, 'principal',   550000, 5, 'DE', 2, '{OneDay,GC}',         'top10_classic',       9),
  ('Trek',              'TRK', 3, 'principal',   550000, 5, 'US', 2, '{OneDay,TT}',         'top10_classic',      10),
  ('Lidl',              'LID', 4, 'principal',   750000, 7, null, 0, '{GC,Sprint}',         'top10_gt_monument',  11),
  ('Red Bull',          'RBL', 4, 'principal',   750000, 7, null, 0, '{GC,TT}',             'top10_gt_monument',  12),
  ('Visma',             'VIS', 4, 'principal',   750000, 7, null, 0, '{GC,OneDay}',         'top10_gt_monument',  13),
  ('UAE Group',         'UAE', 5, 'principal',  1000000, 8, null, 0, '{GC}',                'top5_gt_monument',   14);

-- ---------------------------------------------------------------------------
-- Add race_class column to race_results for sponsor eligibility checks
-- ---------------------------------------------------------------------------
alter table public.race_results
  add column if not exists race_class text check (race_class in ('monument', 'classic', 'grand_tour', 'stage_race', 'one_day'));

-- Backfill race_class from slug patterns
update public.race_results set race_class = 'monument'
where race_class is null and (
  race_slug like '%milano-sanremo%'
  or race_slug like '%ronde-van-vlaanderen%'
  or race_slug like '%paris-roubaix%'
  or race_slug like '%liege-bastogne-liege%'
  or race_slug like '%il-lombardia%'
);

update public.race_results set race_class = 'grand_tour'
where race_class is null and (
  race_slug like '%giro-d-italia%'
  or race_slug like '%tour-de-france%'
  or race_slug like '%vuelta-a-espana%'
);

update public.race_results set race_class = 'classic'
where race_class is null and (
  race_slug like '%strade-bianche%'
  or race_slug like '%e3-harelbeke%'
  or race_slug like '%gent-wevelgem%'
  or race_slug like '%amstel-gold-race%'
  or race_slug like '%la-fleche-wallonne%'
  or race_slug like '%san-sebastian%'
  or race_slug like '%bretagne-classic%'
  or race_slug like '%cyclassics-hamburg%'
  or race_slug like '%gp-quebec%'
  or race_slug like '%gp-montreal%'
  or race_slug like '%omloop-het-nieuwsblad%'
  or race_slug like '%dwars-door-vlaanderen%'
);

update public.race_results set race_class = 'stage_race'
where race_class is null and (
  race_slug like '%paris-nice%'
  or race_slug like '%tirreno-adriatico%'
  or race_slug like '%volta-a-catalunya%'
  or race_slug like '%itzulia%'
  or race_slug like '%tour-de-romandie%'
  or race_slug like '%dauphine%'
  or race_slug like '%tour-de-suisse%'
  or race_slug like '%tour-de-pologne%'
  or race_slug like '%renewi-tour%'
);
