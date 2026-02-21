-- =============================================================
-- WattHunter — Initial Schema
-- 15 tables + RLS + pg_cron jobs
-- =============================================================

-- Extensions (pg_cron enabled via Supabase dashboard if needed)

-- =============================================================
-- 1. USERS (extends Supabase Auth)
-- =============================================================
create table public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- =============================================================
-- 2. LEAGUES
-- =============================================================
create table public.leagues (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  invite_code     text not null unique,
  commissioner_id uuid not null references public.users(id) on delete restrict,
  status          text not null default 'pending' check (status in ('pending','active','completed')),
  max_players     int not null default 10 check (max_players between 6 and 12),
  season_year     int not null default extract(year from now())::int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- =============================================================
-- 3. TEAMS
-- =============================================================
create table public.teams (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  league_id         uuid not null references public.leagues(id) on delete cascade,
  name              text not null,
  treasury          bigint not null default 500000,  -- stored in euros (cents would be overkill)
  cumulative_xp     bigint not null default 0,
  level             int not null default 1 check (level between 1 and 10),
  is_bankrupt       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(user_id, league_id)
);

-- =============================================================
-- 4. LEAGUE_MEMBERS
-- =============================================================
create table public.league_members (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references public.leagues(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  team_id     uuid references public.teams(id) on delete set null,
  joined_at   timestamptz not null default now(),
  unique(league_id, user_id)
);

-- =============================================================
-- 5. RIDERS
-- =============================================================
create table public.riders (
  id                  uuid primary key default gen_random_uuid(),
  pcs_slug            text not null unique,  -- procyclingstats identifier
  full_name           text not null,
  nationality         text,
  real_team           text,
  team_type           text check (team_type in ('WorldTour','ProTeam')),
  photo_url           text,
  age                 int,
  specialty           text check (specialty in ('climber','sprinter','rouleur','puncheur','time_trialist','all_rounder')),
  pcs_points_1yr      int not null default 0,
  pcs_rank            int,
  monthly_salary      int not null default 5000,  -- euros/month, calculated from pcs_points_1yr
  is_active_in_game   boolean not null default true,
  last_synced_at      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- =============================================================
-- 6. CONTRACTS
-- =============================================================
create table public.contracts (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references public.teams(id) on delete cascade,
  rider_id        uuid not null references public.riders(id) on delete restrict,
  locked_salary   int not null,  -- salary locked at auction time
  status          text not null default 'active' check (status in ('active','notice','released')),
  notice_date     date,          -- date release notice was given
  release_date    date,          -- date rider is fully released
  purchased_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- =============================================================
-- 7. RIDER_PCS_HISTORY
-- =============================================================
create table public.rider_pcs_history (
  id          uuid primary key default gen_random_uuid(),
  rider_id    uuid not null references public.riders(id) on delete cascade,
  date        date not null,
  pcs_points  int not null default 0,
  created_at  timestamptz not null default now(),
  unique(rider_id, date)
);

-- =============================================================
-- 8. RIDER_XP_DAILY
-- =============================================================
create table public.rider_xp_daily (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references public.teams(id) on delete cascade,
  rider_id        uuid not null references public.riders(id) on delete cascade,
  contract_id     uuid not null references public.contracts(id) on delete cascade,
  date            date not null,
  raw_pcs_points  int not null default 0,
  policy_bonus    numeric(4,3) not null default 0,  -- e.g. 0.10 = +10%
  xp_gained       int not null default 0,
  created_at      timestamptz not null default now(),
  unique(team_id, rider_id, date)
);

-- =============================================================
-- 9. TREASURY_LOG
-- =============================================================
create table public.treasury_log (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  type        text not null check (type in (
    'starting_fund',
    'auction_purchase',
    'monthly_salary',
    'rider_revenue',
    'sponsor_payment',
    'bankruptcy_release'
  )),
  amount      int not null,  -- positive = inflow, negative = outflow
  description text,
  rider_id    uuid references public.riders(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- =============================================================
-- 10. AUCTIONS
-- =============================================================
create table public.auctions (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references public.leagues(id) on delete cascade,
  name          text not null,  -- e.g. "Pre-Season 2026"
  status        text not null default 'scheduled' check (status in ('scheduled','open','resolving','closed')),
  opens_at      timestamptz not null,
  closes_at     timestamptz not null,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- =============================================================
-- 11. AUCTION_BIDS
-- =============================================================
create table public.auction_bids (
  id          uuid primary key default gen_random_uuid(),
  auction_id  uuid not null references public.auctions(id) on delete cascade,
  rider_id    uuid not null references public.riders(id) on delete restrict,
  team_id     uuid not null references public.teams(id) on delete cascade,
  amount      int not null,  -- bid in euros
  is_winning  boolean not null default false,
  placed_at   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- =============================================================
-- 12. POLICIES (system / seed table)
-- =============================================================
create table public.policies (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug in ('young_blood','road_warriors','national_pride','team_chemistry','specialist')),
  name        text not null,
  description text not null,
  xp_bonus    numeric(4,3) not null default 0.05,  -- 0.05 = +5%
  is_parameterized boolean not null default false,  -- true if requires config (nationality, team, specialty)
  created_at  timestamptz not null default now()
);

-- =============================================================
-- 13. TEAM_POLICIES
-- =============================================================
create table public.team_policies (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  policy_id   uuid not null references public.policies(id) on delete restrict,
  is_active   boolean not null default false,
  config      jsonb,  -- e.g. {"nationality": "FRA"} or {"specialty": "climber"}
  activated_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(team_id, policy_id)
);

-- =============================================================
-- 14. SPONSORS (system / seed table)
-- =============================================================
create table public.sponsors (
  id              uuid primary key default gen_random_uuid(),
  tier            int not null check (tier between 1 and 5),
  option          text not null check (option in ('A','B')),
  name            text not null,
  description     text not null,
  monthly_payment int not null,  -- euros/month base payout
  condition       text,          -- null for option A (unconditional)
  condition_desc  text,
  bonus_payment   int,           -- extra if condition met (option B)
  created_at      timestamptz not null default now(),
  unique(tier, option)
);

-- =============================================================
-- 15. TEAM_SPONSORS
-- =============================================================
create table public.team_sponsors (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references public.teams(id) on delete cascade,
  sponsor_id      uuid not null references public.sponsors(id) on delete restrict,
  status          text not null default 'active' check (status in ('active','expired')),
  started_at      date not null default current_date,
  expires_at      date not null,  -- started_at + 2 months
  last_paid_at    date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- =============================================================
-- INDEXES
-- =============================================================
create index idx_teams_league_id on public.teams(league_id);
create index idx_teams_user_id on public.teams(user_id);
create index idx_contracts_team_id on public.contracts(team_id);
create index idx_contracts_rider_id on public.contracts(rider_id);
create index idx_contracts_status on public.contracts(status);
create index idx_riders_pcs_rank on public.riders(pcs_rank);
create index idx_riders_team_type on public.riders(team_type);
create index idx_rider_xp_daily_team_date on public.rider_xp_daily(team_id, date);
create index idx_treasury_log_team_id on public.treasury_log(team_id);
create index idx_auction_bids_auction_rider on public.auction_bids(auction_id, rider_id);
create index idx_auction_bids_team on public.auction_bids(team_id);
create index idx_auctions_league_status on public.auctions(league_id, status);

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

alter table public.users enable row level security;
alter table public.leagues enable row level security;
alter table public.teams enable row level security;
alter table public.league_members enable row level security;
alter table public.riders enable row level security;
alter table public.contracts enable row level security;
alter table public.rider_pcs_history enable row level security;
alter table public.rider_xp_daily enable row level security;
alter table public.treasury_log enable row level security;
alter table public.auctions enable row level security;
alter table public.auction_bids enable row level security;
alter table public.policies enable row level security;
alter table public.team_policies enable row level security;
alter table public.sponsors enable row level security;
alter table public.team_sponsors enable row level security;

-- Users: read own row, update own row
create policy "users_select_own" on public.users for select using (auth.uid() = id);
create policy "users_update_own" on public.users for update using (auth.uid() = id);
create policy "users_insert_own" on public.users for insert with check (auth.uid() = id);

-- Leagues: members can read their leagues
create policy "leagues_select_member" on public.leagues for select using (
  exists (
    select 1 from public.league_members lm
    where lm.league_id = id and lm.user_id = auth.uid()
  )
);
create policy "leagues_insert_auth" on public.leagues for insert with check (auth.uid() = commissioner_id);
create policy "leagues_update_commissioner" on public.leagues for update using (auth.uid() = commissioner_id);

-- Teams: anyone in same league can read (for standings)
create policy "teams_select_league" on public.teams for select using (
  exists (
    select 1 from public.league_members lm
    where lm.league_id = league_id and lm.user_id = auth.uid()
  )
);
create policy "teams_insert_own" on public.teams for insert with check (auth.uid() = user_id);
create policy "teams_update_own" on public.teams for update using (auth.uid() = user_id);

-- League members: read members of own leagues
create policy "league_members_select" on public.league_members for select using (
  exists (
    select 1 from public.league_members lm2
    where lm2.league_id = league_id and lm2.user_id = auth.uid()
  )
);
create policy "league_members_insert_own" on public.league_members for insert with check (auth.uid() = user_id);

-- Riders: public read (catalogue visible to all authenticated users)
create policy "riders_select_authenticated" on public.riders for select using (auth.uid() is not null);

-- Contracts: read own team's contracts + league mates (for standings context)
create policy "contracts_select_own" on public.contracts for select using (
  exists (
    select 1 from public.teams t where t.id = team_id and t.user_id = auth.uid()
  )
);

-- Rider PCS history: authenticated read
create policy "rider_pcs_history_select" on public.rider_pcs_history for select using (auth.uid() is not null);

-- Rider XP daily: read own team only
create policy "rider_xp_daily_select_own" on public.rider_xp_daily for select using (
  exists (
    select 1 from public.teams t where t.id = team_id and t.user_id = auth.uid()
  )
);

-- Treasury log: read own team only
create policy "treasury_log_select_own" on public.treasury_log for select using (
  exists (
    select 1 from public.teams t where t.id = team_id and t.user_id = auth.uid()
  )
);

-- Auctions: read if member of that league
create policy "auctions_select_member" on public.auctions for select using (
  exists (
    select 1 from public.league_members lm
    where lm.league_id = league_id and lm.user_id = auth.uid()
  )
);

-- Auction bids: hidden until auction closed, then all league members can see
create policy "auction_bids_select" on public.auction_bids for select using (
  exists (
    select 1 from public.auctions a
    join public.league_members lm on lm.league_id = a.league_id
    where a.id = auction_id
      and lm.user_id = auth.uid()
      and (a.status = 'closed' or (
        -- during open auction: only see own bids
        a.status in ('open','resolving') and exists (
          select 1 from public.teams t where t.id = team_id and t.user_id = auth.uid()
        )
      ))
  )
);
create policy "auction_bids_insert_own" on public.auction_bids for insert with check (
  exists (
    select 1 from public.teams t where t.id = team_id and t.user_id = auth.uid()
  )
);

-- Policies: public read (system table)
create policy "policies_select_authenticated" on public.policies for select using (auth.uid() is not null);

-- Team policies: read own
create policy "team_policies_select_own" on public.team_policies for select using (
  exists (
    select 1 from public.teams t where t.id = team_id and t.user_id = auth.uid()
  )
);
create policy "team_policies_insert_own" on public.team_policies for insert with check (
  exists (
    select 1 from public.teams t where t.id = team_id and t.user_id = auth.uid()
  )
);
create policy "team_policies_update_own" on public.team_policies for update using (
  exists (
    select 1 from public.teams t where t.id = team_id and t.user_id = auth.uid()
  )
);

-- Sponsors: public read (system table)
create policy "sponsors_select_authenticated" on public.sponsors for select using (auth.uid() is not null);

-- Team sponsors: read own
create policy "team_sponsors_select_own" on public.team_sponsors for select using (
  exists (
    select 1 from public.teams t where t.id = team_id and t.user_id = auth.uid()
  )
);
create policy "team_sponsors_insert_own" on public.team_sponsors for insert with check (
  exists (
    select 1 from public.teams t where t.id = team_id and t.user_id = auth.uid()
  )
);

-- =============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.leagues
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.teams
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.contracts
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.riders
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.auctions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.team_policies
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.team_sponsors
  for each row execute function public.set_updated_at();
