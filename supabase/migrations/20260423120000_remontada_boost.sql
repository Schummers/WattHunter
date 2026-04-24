-- 20260423120000_remontada_boost.sql
-- Anti-Runaway Mechanism 1: tracking tables for Remontada Boost.
-- See docs/plans/2026-04-23-anti-runaway-system-design.md §3.

create table if not exists remontada_boost_triggers (
  league_id uuid not null references leagues(id) on delete cascade,
  gt_identifier text not null check (gt_identifier in ('giro-d-italia', 'tour-de-france', 'vuelta-a-espana')),
  overtaker_team_id uuid not null references teams(id) on delete cascade,
  overtaken_team_id uuid not null references teams(id) on delete cascade,
  triggered_at_stage integer not null check (triggered_at_stage between 1 and 30),
  created_at timestamptz not null default now(),
  primary key (league_id, gt_identifier, overtaker_team_id, overtaken_team_id)
);

comment on table remontada_boost_triggers is
  'Anti-ping-pong ledger: at most one trigger per ordered (overtaker, overtaken) pair per GT.';

create table if not exists remontada_boosts (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  gt_identifier text not null,
  triggered_at_stage integer not null,
  expires_after_stage integer not null,
  multiplier numeric(3,1) not null default 2.0 check (multiplier > 0),
  overtaken_team_id uuid references teams(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one active boost per team per GT (upsert target).
create unique index remontada_boosts_team_gt_idx
  on remontada_boosts (team_id, gt_identifier);

-- Fast lookup "is this team boosted at stage N of GT X".
create index remontada_boosts_lookup_idx
  on remontada_boosts (team_id, gt_identifier, expires_after_stage);

comment on table remontada_boosts is
  'Active boosts. Reset cumul: latest overtake updates expires_after_stage.';

-- RLS: readable by any member of the league, writable by service role only.
alter table remontada_boost_triggers enable row level security;
alter table remontada_boosts enable row level security;

create policy remontada_triggers_read on remontada_boost_triggers
  for select using (
    exists (
      select 1 from teams t
      where t.league_id = remontada_boost_triggers.league_id
        and t.user_id = auth.uid()
    )
  );

create policy remontada_boosts_read on remontada_boosts
  for select using (
    exists (
      select 1 from teams t
      where t.league_id = remontada_boosts.league_id
        and t.user_id = auth.uid()
    )
  );
