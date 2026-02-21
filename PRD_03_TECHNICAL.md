# PRD 03 — Technical Specification
## Cycling Fantasy Game MVP

**Version:** 3.0
**Date:** 21 février 2026
**Author:** Jonathan Schummers
**Read alongside:** PRD_01_OVERVIEW.md · PRD_02_MECHANICS.md

> This document is the source of truth for implementation. Every requirement has explicit acceptance criteria. Build features in the priority order defined in PRD_01_OVERVIEW §MVP Feature Scope.

---

## 1. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Mobile app | **React Native + Expo** (managed workflow) | iOS + Android from single codebase |
| Backend / Auth | **Supabase** | Auth, Postgres, Realtime, Edge Functions |
| Database | **Supabase Postgres** | All data, with Row Level Security |
| Scheduled jobs | **pg_cron** (Supabase) | Daily PCS sync at 08:00 UTC |
| Data source | **procyclingstats** Python lib | Scraping PCS, free, gray-area acceptable for MVP |
| Email | **Supabase built-in** (start) → migrate to Postmark if volume needed | Transactional: outbid alerts, auction recaps |
| Hosting | Supabase free tier → Pro if needed | 0€ for MVP scale (<100 users) |

### Environment Variables (to provision)
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
PCS_RATE_LIMIT_DELAY_MS=4000       # delay between PCS requests (avoid ban)
CONVERSION_RATE_EUR_PER_PCS=500    # placeholder, calibrate before launch
```

---

## 2. Database Schema

### 2.1 `users`
Managed by Supabase Auth. Extended profile:
```sql
CREATE TABLE users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id),
  email       text NOT NULL,
  display_name text,
  avatar_url  text,
  created_at  timestamptz DEFAULT now()
);
```

### 2.2 `teams`
One team per user (MVP constraint).
```sql
CREATE TABLE teams (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL UNIQUE REFERENCES users(id),
  name             text NOT NULL,
  treasury         bigint NOT NULL DEFAULT 500000,  -- in euros, integer cents avoided for MVP
  xp_cumulative    bigint NOT NULL DEFAULT 0,
  level            int NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10),
  is_bankrupt      boolean NOT NULL DEFAULT false,
  bankrupt_since   date,
  created_at       timestamptz DEFAULT now()
);
```

### 2.3 `leagues`
```sql
CREATE TABLE leagues (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            char(6) NOT NULL UNIQUE,          -- invitation code
  name            text NOT NULL,
  commissioner_id uuid NOT NULL REFERENCES teams(id),
  max_players     int NOT NULL DEFAULT 10 CHECK (max_players BETWEEN 6 AND 12),
  status          text NOT NULL DEFAULT 'waiting'   -- waiting | active | finished
    CHECK (status IN ('waiting', 'active', 'finished')),
  created_at      timestamptz DEFAULT now()
);
```

### 2.4 `league_members`
```sql
CREATE TABLE league_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   uuid NOT NULL REFERENCES leagues(id),
  team_id     uuid NOT NULL REFERENCES teams(id),
  joined_at   timestamptz DEFAULT now(),
  invited_by  uuid REFERENCES teams(id),   -- NULL if self-joined or commissioner
  UNIQUE (league_id, team_id)
);
```

### 2.5 `riders`
Master catalogue of all professional riders.
```sql
CREATE TABLE riders (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pcs_slug              text UNIQUE NOT NULL,          -- PCS URL slug, used as stable ID
  first_name            text NOT NULL,
  last_name             text NOT NULL,
  nationality           char(2) NOT NULL,              -- ISO 3166-1 alpha-2
  real_team             text NOT NULL,                  -- UCI team name
  team_type             text NOT NULL CHECK (team_type IN ('ProTeam', 'WorldTour')),
  photo_url             text,
  age                   int,
  specialty             text CHECK (specialty IN (
                          'climber', 'sprinter', 'rouleur',
                          'puncheur', 'time_trialist', 'all_rounder'
                        )),
  pcs_points_rolling_1y int NOT NULL DEFAULT 0,
  pcs_rank              int,
  min_salary_monthly    int NOT NULL DEFAULT 5000,     -- calculated, floored at 5000
  last_synced_at        timestamptz,
  is_active_in_game     boolean NOT NULL DEFAULT false, -- true = currently owned by a player
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
```

### 2.6 `contracts`
Tracks which rider belongs to which team, at what salary.
```sql
CREATE TABLE contracts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id          uuid NOT NULL REFERENCES riders(id),
  team_id           uuid NOT NULL REFERENCES teams(id),
  purchase_price    int NOT NULL,               -- winning auction bid in €
  contract_salary   int NOT NULL,               -- locked salary in €/month
  contract_start    date NOT NULL,
  status            text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'notice', 'released')),
  notice_start      date,                       -- set when player initiates release
  release_date      date,                       -- when contract fully terminates
  created_at        timestamptz DEFAULT now()
);

-- A rider can only have one active/notice contract at a time
CREATE UNIQUE INDEX contracts_rider_active ON contracts(rider_id)
  WHERE status IN ('active', 'notice');
```

### 2.7 `rider_pcs_history`
Daily PCS points per rider (only for recruited riders, updated daily).
```sql
CREATE TABLE rider_pcs_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id     uuid NOT NULL REFERENCES riders(id),
  date         date NOT NULL,
  pcs_points   int NOT NULL DEFAULT 0,    -- cumulative PCS points on this date
  points_delta int NOT NULL DEFAULT 0,    -- points gained this specific day
  UNIQUE (rider_id, date)
);
```

### 2.8 `rider_xp_daily`
Daily XP score per rider per team (after policy multipliers).
```sql
CREATE TABLE rider_xp_daily (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id            uuid NOT NULL REFERENCES riders(id),
  team_id             uuid NOT NULL REFERENCES teams(id),
  date                date NOT NULL,
  pcs_points_raw      int NOT NULL DEFAULT 0,
  xp_with_multipliers numeric(10,2) NOT NULL DEFAULT 0,
  UNIQUE (rider_id, team_id, date)
);
```

### 2.9 `treasury_log`
Every treasury movement is logged (full audit trail).
```sql
CREATE TABLE treasury_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES teams(id),
  amount      int NOT NULL,      -- positive = inflow, negative = outflow
  type        text NOT NULL CHECK (type IN (
                'starting_fund', 'auction_win', 'salary',
                'rider_revenue', 'sponsor', 'auto_release_refund'
              )),
  description text,
  reference_id uuid,             -- e.g., contract_id, auction_bid_id
  created_at  timestamptz DEFAULT now()
);
```

### 2.10 `auctions`
```sql
CREATE TABLE auctions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       uuid NOT NULL REFERENCES leagues(id),
  label           text,          -- e.g., "Pre-Tour de France Auction"
  opens_at        timestamptz NOT NULL,
  closes_at       timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'open', 'resolving', 'closed')),
  created_at      timestamptz DEFAULT now()
);
```

### 2.11 `auction_bids`
```sql
CREATE TABLE auction_bids (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id  uuid NOT NULL REFERENCES auctions(id),
  rider_id    uuid NOT NULL REFERENCES riders(id),
  team_id     uuid NOT NULL REFERENCES teams(id),
  amount      int NOT NULL,          -- bid amount in €
  bid_time    timestamptz NOT NULL DEFAULT now(),
  is_winning  boolean NOT NULL DEFAULT false,   -- set during resolution
  UNIQUE (auction_id, rider_id, team_id)        -- one live bid per team/rider pair
);
-- Latest bid per team/rider in this auction
-- On update: replace the row (upsert on conflict)
```

### 2.12 `policies`
Seeded at DB init — not user-created.
```sql
CREATE TABLE policies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text UNIQUE NOT NULL,   -- 'young_blood' | 'road_warriors' | 'national_pride' | 'team_chemistry' | 'specialist'
  name          text NOT NULL,
  description   text NOT NULL,
  bonus_pct     numeric(4,2) NOT NULL DEFAULT 5.00,  -- 5.00 = +5%
  requires_config boolean NOT NULL DEFAULT false,    -- national_pride/team_chemistry/specialist need value
  config_type   text    -- 'nationality' | 'real_team' | 'specialty' | NULL
);

-- Seed:
INSERT INTO policies VALUES
  (gen_random_uuid(), 'young_blood',    'Young Blood',    '+5% XP for riders under 23',  5.00, false, null),
  (gen_random_uuid(), 'road_warriors',  'Road Warriors',  '+5% XP for riders over 30',   5.00, false, null),
  (gen_random_uuid(), 'national_pride', 'National Pride', '+5% XP for chosen nationality',5.00, true, 'nationality'),
  (gen_random_uuid(), 'team_chemistry', 'Team Chemistry', '+5% XP for chosen real team',  5.00, true, 'real_team'),
  (gen_random_uuid(), 'specialist',     'Specialist',     '+5% XP for chosen specialty',  5.00, true, 'specialty');
```

### 2.13 `team_policies`
```sql
CREATE TABLE team_policies (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL REFERENCES teams(id),
  policy_id    uuid NOT NULL REFERENCES policies(id),
  is_active    boolean NOT NULL DEFAULT true,
  config_value text,          -- e.g., 'BE', 'Visma–Lease a Bike', 'climber'
  activated_at timestamptz DEFAULT now(),
  UNIQUE (team_id, policy_id)
);
-- Max active rows where is_active=true per team enforced at application level (0, 1, 2, or 3 based on level)
```

### 2.14 `sponsors`
Seeded at DB init.
```sql
CREATE TABLE sponsors (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier             int NOT NULL CHECK (tier BETWEEN 1 AND 5),
  level_unlock     int NOT NULL,
  option           char(1) NOT NULL CHECK (option IN ('A', 'B')),
  name             text NOT NULL,
  amount_2months   int NOT NULL,       -- total payout over 2-month contract, in €
  has_condition    boolean NOT NULL DEFAULT false,
  condition_type   text,               -- 'nationality_count' | 'age_under_23_count' | 'specialty_count' | 'real_team_count'
  condition_value  int,                -- min count required
  condition_desc   text                -- human-readable description
);

-- Seed (examples):
INSERT INTO sponsors VALUES
  -- Tier 1 Level 3
  (gen_random_uuid(), 1, 3, 'A', 'VéloBase', 80000, false, null, null, null),
  (gen_random_uuid(), 1, 3, 'B', 'PédalSport', 120000, true, 'nationality_count', 3, '≥3 riders of same nationality'),
  -- Tier 2 Level 5
  (gen_random_uuid(), 2, 5, 'A', 'CycleTech', 170000, false, null, null, null),
  (gen_random_uuid(), 2, 5, 'B', 'JeunésPros', 220000, true, 'age_under_23_count', 2, '≥2 riders under 23'),
  -- Tier 3 Level 7
  (gen_random_uuid(), 3, 7, 'A', 'GrandFondo', 250000, false, null, null, null),
  (gen_random_uuid(), 3, 7, 'B', 'SpecialistGear', 300000, true, 'specialty_count', 2, '≥2 riders of same specialty'),
  -- Tier 4 Level 9
  (gen_random_uuid(), 4, 9, 'A', 'EliteRacing', 400000, false, null, null, null),
  (gen_random_uuid(), 4, 9, 'B', 'TeamSynergy', 500000, true, 'real_team_count', 3, '≥3 riders from same real-life team'),
  -- Tier 5 Level 10
  (gen_random_uuid(), 5, 10, 'A', 'PlatinumSport', 800000, false, null, null, null),
  (gen_random_uuid(), 5, 10, 'B', 'ChampionAlliance', 1000000, true, 'nationality_count', 4, '≥4 riders same nationality OR ≥3 from same real team');
```

### 2.15 `team_sponsors`
```sql
CREATE TABLE team_sponsors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL REFERENCES teams(id),
  sponsor_id   uuid NOT NULL REFERENCES sponsors(id),
  start_date   date NOT NULL,
  end_date     date NOT NULL,              -- always start_date + 2 months
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now()
);
-- Max 1 row where is_active=true per team (enforced at application level)
```

---

## 3. Row Level Security (RLS) Summary

| Table | Policy |
|-------|--------|
| `users` | Read own row only |
| `teams` | Read any (for league standings); write own only |
| `contracts` | Read own team's; read other teams' basic info (for standings) |
| `rider_pcs_history` | Read any (needed for team detail views) |
| `auction_bids` | Read own bids; cannot read competitors' bid amounts until auction resolves |
| `treasury_log` | Read own team only |
| `team_policies` | Read/write own team only |
| `team_sponsors` | Read/write own team only |

---

## 4. Data Pipeline

### 4.1 Daily Batch — All Riders (08:00 UTC via pg_cron)

**Scope:** All ~923 riders in the DB.
**Data fetched:** `first_name`, `last_name`, `nationality`, `real_team`, `team_type`, `photo_url`, `age`, `specialty`, `pcs_points_rolling_1y`, `pcs_rank`

**Procedure:**
1. Fetch all rider PCS slugs from `riders` table
2. For each slug: call procyclingstats lib with 3–5 second delay between requests
3. Upsert into `riders` (update fields, set `updated_at`, `last_synced_at`)
4. Recalculate `min_salary_monthly` using formula (see PRD_02 §2.2)
5. Update `pcs_rank` → used to determine rider access tier per player level
6. **Retry:** 3 attempts per rider on failure. After 3 failures, log error and skip.
7. **Alert:** Send admin email if >5% of riders fail sync.

**Rate limiting:** 4 seconds between requests (configurable via env). Estimated run time: ~923 riders × 4s = ~62 minutes. Runs daily at 08:00 UTC.

### 4.2 On-Demand — Recruited Riders (triggered at auction resolution)

**Trigger:** Player wins a rider at auction.
**Data fetched:** Detailed race results (2 years), historical PCS points (day by day for 365 days)

**Procedure:**
1. Auction resolution identifies winner + rider
2. Trigger async Edge Function: `fetch_rider_detail(rider_id)`
3. Backfill `rider_pcs_history` table with daily points for past 365 days
4. Set `is_active_in_game = true` on rider row

**Ongoing:** Once in `rider_pcs_history`, this rider's daily delta is updated as part of a **second daily job** (08:30 UTC): only riders with `is_active_in_game = true`.

**On release:** When rider released, set `is_active_in_game = false`. Stop daily detailed sync. Keep historical data (needed for ROI views).

### 4.3 XP Calculation Job (09:00 UTC — after data sync completes)

For each team with active contracts:
1. For each rider in team's active contracts:
   - Get `points_delta` for today from `rider_pcs_history`
   - Evaluate all active policies for this team: calculate total bonus %
   - Compute `xp_with_multipliers = points_delta × (1 + total_bonus)`
   - Insert row into `rider_xp_daily`
2. Sum all `rider_xp_daily.xp_with_multipliers` for today → update `teams.xp_cumulative`
3. Check if new `xp_cumulative` crosses next level threshold → if yes, level up team
4. Upsert `teams` with new `xp_cumulative` and `level`

### 4.4 Monthly Financial Job (1st of each month, 00:01 UTC)

1. For each team:
   a. **Deduct salaries:** Sum all `contracts.contract_salary` where status = 'active' or 'notice'. Insert `treasury_log` row (type=`salary`). Update `teams.treasury`.
   b. **Check bankruptcy:** If `treasury < 0`, set `is_bankrupt = true`. If already bankrupt since last month → trigger auto-release (most expensive salary first until treasury projected positive).
   c. **Credit sponsor:** If team has active sponsor with `end_date >= today`:
      - Evaluate sponsor condition (see PRD_02 §6.4)
      - Credit `amount_2months / 2` (or Option A amount if condition fails)
      - Insert `treasury_log` row (type=`sponsor`)
   d. **Expire notice contracts:** Any contract with `status='notice'` where `notice_start` was ≥30 days ago → set `status='released'`, `is_active_in_game=false` on rider.
   e. **Expire sponsor contracts:** Any `team_sponsors` where `end_date < today` → set `is_active = false`. Send email prompt to select new sponsor.

---

## 5. Functional Requirements — P0 (Must Ship)

### Auth & Onboarding

**REQ-001 — OAuth with Google and Apple**
- AC: Google login completes in <5 sec
- AC: Apple login completes in <5 sec
- AC: JWT managed automatically by Supabase; client receives valid session token
- AC: On first login, user row created in `users` table

**REQ-002 — Onboarding flow, ≤3 screens**
- AC: Screen 1 — concept in 2 sentences + visual
- AC: Screen 2 — how it works (auction → team → points → standings)
- AC: Screen 3 — create or join a league
- AC: Skip button available on every screen
- AC: Onboarding shown only once (flag in `users` or AsyncStorage)

---

### Leagues

**REQ-003 — Create a private league**
- AC: Commissioner enters league name + max players (6–12)
- AC: System generates unique 6-character alphanumeric code (uppercase, no ambiguous chars: 0/O, 1/I)
- AC: Code displayed prominently with copy button
- AC: League inserted with `status='waiting'`

**REQ-004 — Join a league via code**
- AC: Player enters 6-character code → validated against `leagues` table
- AC: If league full → error "League is full (X/X players)"
- AC: If league already active → error "This league has already started"
- AC: On success → `league_members` row created, player sees league lobby

**REQ-005 — Launch first auction (Commissioner)**
- AC: Commissioner can launch only when ≥4 players have joined
- AC: Launch creates first `auctions` row with `opens_at = now()`, `closes_at = now() + 72h`
- AC: League `status` changes to `'active'`
- AC: All league members receive email notification "Auction is open!"

---

### Rider Catalogue

**REQ-006 — Browse rider catalogue (in auction context)**
- AC: Only shows riders accessible to player's current level (see PRD_02 §1 access table)
- AC: Riders already owned by any player in the league are shown but greyed out (non-biddable)
- AC: Default sort: PCS rank ascending (highest ranked first)
- AC: Filters available: nationality (multi-select), real team (multi-select), specialty (multi-select), salary range (min–max slider)
- AC: Search bar: fuzzy match on first_name + last_name (min 2 characters to trigger)
- AC: Rider card shows: photo, name, nationality flag, real team, specialty icon, PCS points 1yr, salary/month

**REQ-007 — Rider detail screen**
- AC: Photo, full name, age, nationality, real team, specialty
- AC: PCS points rolling 1yr + PCS rank
- AC: Estimated salary per month
- AC: If rider is already in player's team: show contract salary + ROI stats
- AC: If rider has `is_active_in_game=true` (owned by another player): show "Owned by [team name]"
- AC: Graph: PCS points over last 30/90 days (if detailed history available)

---

### Auction System

**REQ-008 — Place / update a bid**
- AC: Minimum bid = rider's current `min_salary_monthly`
- AC: Minimum increment = current highest bid + 100€ (or floor if no bids yet)
- AC: Budget check: `sum(all active bids by this player) + new bid ≤ team.treasury`. If fails → "Insufficient budget" error with exact deficit shown.
- AC: Bid upserted (one active bid per player/rider pair per auction)
- AC: Bid timestamp recorded (used for tie-breaking)

**REQ-009 — Outbid notification (email)**
- AC: When player A's bid is beaten by player B, player A receives email within 5 minutes
- AC: Email contains: rider name, your previous bid, new highest bid, link to auction
- AC: Email sends only if player A is not currently the highest bidder (no spam for own bids)

**REQ-010 — Auction timer display**
- AC: Countdown visible on all auction screens: "Closes in 47h 23m 14s"
- AC: Timer updates every second while auction is open

**REQ-011 — Auction resolution (auto at T=0)**
- AC: Cron job triggers at `auctions.closes_at`
- AC: Auction status set to `'resolving'` (prevents new bids during resolution)
- AC: For each rider: identify highest bid. Tie → earliest `bid_time` wins.
- AC: Budget cascade check (see PRD_02 §7.3). Mark `is_winning=true` on winning bids.
- AC: For each winning bid: deduct `amount` from team treasury. Insert `treasury_log`. Create `contracts` row. Set `is_active_in_game=true` on rider. Trigger on-demand detail fetch.
- AC: Auction status set to `'closed'`
- AC: Recap email sent to all league members within 5 min: list of won riders per team, amounts paid

**REQ-012 — Auction history**
- AC: Past auctions browsable from league screen
- AC: Per auction: date, list of riders won, by whom, at what price
- AC: Per rider in history: market salary at time vs. price paid (shows % premium)

---

### Team Management

**REQ-013 — Roster view ("My Team")**
- AC: List view: photo, name, real team, nationality, specialty, PCS points this month (delta), contract salary, monthly profit/loss, ROI indicator (green/red)
- AC: Red indicator if rider is loss-making this month
- AC: Tap rider → detail screen (REQ-007)

**REQ-014 — Treasury widget (always visible)**
- AC: Shown in app header: "Treasury: €245,000"
- AC: Tap → detail: salary burn/mo, estimated revenue/mo, 3-month projection, full treasury log

**REQ-015 — Salary deduction (automated, 1st of month)**
- AC: All salaries deducted at 00:01 UTC on 1st
- AC: Each deduction logged in `treasury_log` (type='salary', description="Salary: [rider name]")
- AC: Player notified by email of total salary deduction

**REQ-016 — Rider profitability revenue (automated, daily)**
- AC: After XP job completes (09:00 UTC), compute revenue per rider: `points_delta × CONVERSION_RATE`
- AC: Deduct contract salary daily fraction: `contract_salary / 30`
- AC: Net daily amount logged in `treasury_log` (type='rider_revenue')
- AC: Treasury updated accordingly

**REQ-017 — Release a rider**
- AC: Confirmation popup shows: rider name, 1 more month salary cost, slot freed immediately
- AC: On confirm: `contracts.status` → 'notice', `notice_start` = today, slot count decremented
- AC: Rider appears in "On Notice" section of roster until release date

**REQ-018 — Bankrupt state**
- AC: When `teams.is_bankrupt = true`: banner "⚠️ BANKRUPT — Pay your riders or lose them" displayed
- AC: Player blocked from placing auction bids while bankrupt
- AC: If still bankrupt at next month start: auto-release most expensive rider(s) until budget projects positive
- AC: Auto-release logged in `treasury_log`, player notified by email

---

### Policies

**REQ-019 — Policy management screen**
- AC: Shows all 5 policy types with name, description, bonus %
- AC: Locked policies shown greyed with "Unlock at Level X" label
- AC: Unlocked policies show toggle to activate (max active = level-based limit)
- AC: Parameterized policies (National Pride, Team Chemistry, Specialist) show dropdown to select value when activating
- AC: Cannot activate more policies than current level allows. Error: "You can only have X active policies at Level Y"
- AC: Changes take effect at next daily XP calculation

**REQ-020 — Policy multiplier in XP calculation**
- AC: For each rider, evaluate active policies: check age, nationality, real_team, specialty against rider fields
- AC: Sum all applicable bonuses (additive): `total_bonus = Σ(bonus_pct / 100)` for matching policies
- AC: `xp_with_multipliers = pcs_points_raw × (1 + total_bonus)`
- AC: Policy config_value must match exactly (case-insensitive for text fields)

---

### Sponsors

**REQ-021 — Sponsor selection screen**
- AC: Appears when team reaches Level 3 (first unlock) and when current sponsor contract expires
- AC: Shows only tiers available at player's current level
- AC: Each tier shows 2 options (A and B) with amounts, conditions described in plain language
- AC: Player selects one option → contract created with `start_date = first upcoming 1st of month`
- AC: Cannot change sponsor mid-contract. "Next change available: [date]" shown.

**REQ-022 — Sponsor payment (automated, 1st of month)**
- AC: On payment day: evaluate condition (if Option B selected)
- AC: If condition met → credit `amount_2months / 2`
- AC: If condition not met → credit Option A equivalent amount for that tier
- AC: Logged in `treasury_log` (type='sponsor')
- AC: Player notified of payment + condition result

---

### Scoring & League Standings

**REQ-023 — Daily XP update**
- AC: Runs at 09:00 UTC after PCS data sync
- AC: `rider_xp_daily` populated for all active contracts
- AC: `teams.xp_cumulative` updated
- AC: `teams.level` updated if threshold crossed

**REQ-024 — League standings screen**
- AC: Sorted by `xp_cumulative` DESC, updated daily
- AC: Shows: rank, team name, player name, XP total, change vs yesterday (↑↓)
- AC: Tap team → team detail: roster, level, XP breakdown by rider

**REQ-025 — Level progression display**
- AC: Progress bar: "Level 5 — 35,521 XP / 54,728 XP"
- AC: Preview of next unlock shown: "Level 6 unlocks: 2 active policies, Tier 2 sponsors"
- AC: Level up triggers celebration animation + push/email notification

---

## 6. Functional Requirements — P1 (Nice to Have)

**REQ-026** — Dark mode
**REQ-027** — Auction analytics: "You paid 20% above league average for this rider"
**REQ-028** — Team comparison: side-by-side view of two teams
**REQ-029** — Performance graph: team XP evolution over season (line chart)
**REQ-030** — Advanced rider stats: wins, podiums, top-10s, form trend (4-week rolling)
**REQ-031** — Deep link to share league join URL (WhatsApp, SMS)

---

## 7. Functional Requirements — P2 (Future, Out of Scope MVP)

**REQ-032** — In-app chat per league *(pre-create `messages` table in schema now)*
**REQ-033** — Push notifications native *(pre-create notification queue table)*
**REQ-034** — Multi-league per user *(schema already supports it — `league_members` is many-to-many)*
**REQ-035** — Global competitive mode (paid tier) *(pre-create `tier` enum in `users` table)*
**REQ-036** — Achievements & badges
**REQ-037** — Discord bot integration
**REQ-038** — Strava connect (real-world cycling → bonus XP)

---

## 8. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Auth response time | < 5 seconds (Google/Apple OAuth) |
| Rider catalogue load | < 2 seconds (paginated, max 50/page) |
| Auction bid submission | < 1 second response |
| Auction resolution | < 2 minutes for full resolution after close |
| Daily sync completion | Before 09:00 UTC (data ready for XP job) |
| Outbid email | < 5 minutes after bid beaten |
| Data consistency | Treasury balance must match sum of `treasury_log`. Check via daily reconciliation job. |
| Offline handling | App shows cached data if offline; blocks writes; shows "You're offline" banner |
| Security | RLS enforced on all tables. Users cannot read other teams' bid amounts during live auction. |

---

## 9. Auction Schedule Seeding

Seed the 2026 season auction calendar at DB init:

```sql
-- Approximate 2026 calendar (adjust with real Grand Tour dates)
INSERT INTO auction_calendar (label, opens_at, closes_at) VALUES
  ('Pre-Season',         '2026-02-20 08:00 UTC', '2026-02-23 08:00 UTC'),
  ('Spring Classics',    '2026-03-06 08:00 UTC', '2026-03-09 08:00 UTC'),
  ('Pre-Giro',           '2026-05-01 08:00 UTC', '2026-05-04 08:00 UTC'),
  ('Mid-Season',         '2026-06-12 08:00 UTC', '2026-06-15 08:00 UTC'),
  ('Pre-Tour de France', '2026-06-26 08:00 UTC', '2026-06-29 08:00 UTC'),
  ('Pre-Vuelta',         '2026-08-14 08:00 UTC', '2026-08-17 08:00 UTC'),
  ('End-of-Season',      '2026-09-11 08:00 UTC', '2026-09-14 08:00 UTC');
-- Commissioner can create league-specific auctions from this global calendar
```

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PCS blocks scraping (IP ban) | Medium | High | 4s delay between requests; rotate IP if needed; rate limit alerts |
| procyclingstats lib breaks (PCS changes HTML) | Medium | High | Pin lib version; monitor for failures; have manual data fallback |
| Conversion rate badly calibrated → broken economy | High (without testing) | High | **Must run Excel simulation before launch. Use 500€ placeholder only for dev.** |
| XP thresholds too fast/slow → 6 months too easy/hard | Medium | Medium | Recalibrate thresholds after simulation with real PCS data |
| Sponsor condition too hard → all players pick Option A | Low | Low | Monitor in alpha; adjust conditions if needed in V1.5 |
| Supabase Edge Functions can't run Python | High | Medium | procyclingstats is Python. **Likely needs external microservice (Railway/Render free tier).** Validate this week. |

---

## 11. Open Questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Calibrate conversion rate €/PCS point (Excel simulation) | Jonathan | ✅ Yes |
| 2 | Can procyclingstats run in Supabase Edge Functions (Deno) or need Node.js microservice? | Engineering | ✅ Yes |
| 3 | PCS rate limit: how many requests/hour before IP ban? | Engineering | Yes (affects daily job timing) |
| 4 | Confirm salary cap at 300,000€/mo with real PCS data | Jonathan | No |
| 5 | Confirm XP thresholds once real PCS data simulated | Jonathan | No |
| 6 | Email provider: Supabase built-in vs. SendGrid/Postmark | Jonathan | No |
| 7 | App color palette | Design | No |

---

## 12. Implementation Order (for Claude Code)

Follow this sequence to avoid dependency issues:

1. **DB Schema** — Apply all migrations (§2)
2. **Auth** — REQ-001 (Supabase OAuth)
3. **Onboarding** — REQ-002
4. **League CRUD** — REQ-003, REQ-004, REQ-005
5. **Rider seeding** — Set up procyclingstats pipeline, seed `riders` table
6. **Daily PCS sync** — REQ (data pipeline §4.1 and §4.2)
7. **Auction system** — REQ-008 through REQ-012
8. **Team management** — REQ-013 through REQ-018
9. **XP engine** — REQ-023, REQ-024, REQ-025
10. **Policies** — REQ-019, REQ-020
11. **Sponsors** — REQ-021, REQ-022
12. **Polish** — REQ-026 through REQ-031
