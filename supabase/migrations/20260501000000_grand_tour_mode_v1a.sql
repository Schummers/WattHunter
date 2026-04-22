-- Migration: Grand Tour Mode V1a
-- Adds gt_squad, gt_role_assignments, gt_daily_classifications + race_results.is_itt

-- ---------------------------------------------------------------------------
-- 1. gt_squad — which roster riders form the squad for a given GT phase
-- ---------------------------------------------------------------------------
create table public.gt_squad (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  phase_id    int  not null check (phase_id in (4, 6, 8)),
  year        int  not null,
  rider_id    uuid not null references public.riders(id) on delete restrict,
  created_at  timestamptz not null default now(),
  unique(team_id, phase_id, year, rider_id)
);

create index idx_gt_squad_team_phase on public.gt_squad(team_id, phase_id, year);

alter table public.gt_squad enable row level security;

create policy "GT squad readable by league members"
  on public.gt_squad for select
  using (
    team_id in (
      select t.id from public.teams t
      join public.league_members lm on lm.league_id = t.league_id
      where lm.user_id = auth.uid()
    )
  );

create policy "GT squad writable by team owner"
  on public.gt_squad for all to authenticated
  using (team_id in (select id from public.teams where user_id = auth.uid()))
  with check (team_id in (select id from public.teams where user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. gt_role_assignments — append-only role history with 11:00 CET cutoff
-- ---------------------------------------------------------------------------
create table public.gt_role_assignments (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  phase_id    int  not null check (phase_id in (4, 6, 8)),
  year        int  not null,
  rider_id    uuid not null references public.riders(id) on delete restrict,
  role        text not null check (role in ('gc_leader', 'sprinter', 'climber', 'tt_specialist', 'stage_hunter', 'domestique')),
  applied_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index idx_gt_role_team_phase
  on public.gt_role_assignments(team_id, phase_id, year, rider_id, applied_at desc);

alter table public.gt_role_assignments enable row level security;

create policy "GT role assignments readable by league members"
  on public.gt_role_assignments for select
  using (
    team_id in (
      select t.id from public.teams t
      join public.league_members lm on lm.league_id = t.league_id
      where lm.user_id = auth.uid()
    )
  );

create policy "GT role assignments writable by team owner"
  on public.gt_role_assignments for all to authenticated
  using (team_id in (select id from public.teams where user_id = auth.uid()))
  with check (team_id in (select id from public.teams where user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. gt_daily_classifications — per-stage GC / points / KOM rank cache
-- ---------------------------------------------------------------------------
create table public.gt_daily_classifications (
  race_slug           text not null,
  stage               text not null,
  rider_id            uuid not null references public.riders(id) on delete cascade,
  classification_type text not null check (classification_type in ('gc', 'points', 'kom')),
  rank                int  not null,
  created_at          timestamptz not null default now(),
  primary key (race_slug, rider_id, classification_type)
);

create index idx_gt_classif_rider
  on public.gt_daily_classifications(rider_id, classification_type);

alter table public.gt_daily_classifications enable row level security;

create policy "GT daily classifications readable by all"
  on public.gt_daily_classifications for select using (true);

-- Writes are service_role only (no RLS policy for writes → blocked from anon/auth).

-- ---------------------------------------------------------------------------
-- 4. race_results.is_itt flag
-- ---------------------------------------------------------------------------
alter table public.race_results
  add column if not exists is_itt boolean not null default false;

-- Backfill: mark known 2026 ITT stages up to now.
-- Operators: edit this list if new ITTs have been imported before the migration runs.
update public.race_results
  set is_itt = true
  where race_slug in (
    'race/paris-nice/2026/stage-3',
    'race/tirreno-adriatico/2026/stage-7',
    'race/volta-a-catalunya/2026/stage-2',
    'race/itzulia-basque-country/2026/stage-1'
  );
