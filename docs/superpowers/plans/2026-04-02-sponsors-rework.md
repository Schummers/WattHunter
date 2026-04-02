# Sponsors Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the complex 2-slot, eligibility-gated sponsor system with a simplified 1-sponsor-per-team model: 6 tiers, 13 sponsors, level-only gating, fixed phase-based income, and race result bonuses with multipliers.

**Architecture:** Three layers change in lockstep: (1) A single Supabase migration drops old schema and seeds the new 13-sponsor model with bonus columns; (2) Python pipeline replaces monthly finance with phase-based finance and adds sponsor bonus calculation on post-race; (3) Frontend rewrites the marketplace as a single-sponsor picker and updates the budget page for phase-based income.

**Tech Stack:** Supabase (Postgres), Python 3.9+ (FastAPI, pytest), Next.js 16 App Router (TypeScript, Tailwind v4, Shadcn UI)

**Design Spec:** `docs/superpowers/specs/2026-04-02-sponsors-rework-design.md`

---

## File Structure

### Database
| Action | File | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/20260402300000_sponsors_rework.sql` | Drop old schema, create new sponsors (13 rows), simplify team_sponsors, create sponsor_bonuses, update treasury_log types |

### Python Pipeline (`services/pcs-sync/`)
| Action | File | Responsibility |
|--------|------|----------------|
| Create | `sponsor_bonus.py` | Result type classification + sponsor bonus calculation + process_race_bonuses() |
| Create | `phase_finance.py` | Daily sponsor base income + daily salary deduction + bankruptcy check |
| Create | `tests/test_sponsor_bonus.py` | Unit tests for bonus calc, classification, multipliers |
| Create | `tests/test_phase_finance.py` | Unit tests for daily finance flow |
| Modify | `scoring.py` | Remove calculate_rider_bonus, CONVERSION_RATE, revenue_earned, treasury updates — keep XP only |
| Modify | `run_pipeline.py` | Replace `monthly-finance` with `phase-finance`, add sponsor bonus call after post-race scoring |
| Modify | `main.py` | Add `/jobs/phase-finance` endpoint, update `/jobs/daily-scoring` docstring |
| Modify | `tests/test_scoring.py` | Remove revenue tests, update mock chains (fewer table calls since no treasury update) |

### Frontend (`apps/web/`)
| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `lib/sponsors.ts` | New SponsorRow type (bonus columns), remove eligibility interfaces, remove RACE_CLASS_MAP |
| Modify | `lib/levels.ts` | Update sponsor descriptions for new tier structure |
| Rewrite | `app/(game)/league/[leagueId]/budget/marketplace/page.tsx` | Simplified server component: fetch sponsors + team level, no eligibility checks |
| Rewrite | `app/(game)/league/[leagueId]/budget/marketplace/marketplace-client.tsx` | Single-sponsor picker grouped by tier, bonus table display, lock by level |
| Rewrite | `app/(game)/league/[leagueId]/budget/actions.ts` | Simplified saveSponsor (single sponsor, immediate, next-day effective) |
| Modify | `app/(game)/league/[leagueId]/budget/page.tsx` | Phase income display, remove pending state, remove first_phase_budget logic |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260402300000_sponsors_rework.sql`

### Step 1.1: Write the migration — Drop old tables and recreate sponsors

- [ ] **Step 1.1.1: Write the migration file**

```sql
-- =============================================================================
-- Sponsors Rework Migration (2026-04-02)
-- Replaces: 2-slot eligibility-gated system
-- New: 1-sponsor-per-team, 6 tiers, 13 sponsors, level-only gating, daily finance
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop dependent tables first (order matters for foreign keys)
-- ---------------------------------------------------------------------------
drop table if exists public.team_sponsors cascade;
drop table if exists public.sponsors cascade;

-- ---------------------------------------------------------------------------
-- 2. Recreate sponsors with new schema
-- ---------------------------------------------------------------------------
create table public.sponsors (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null unique,
  slug                text not null unique,
  tier                int not null check (tier between 1 and 6),
  unlock_level        int not null check (unlock_level between 1 and 8),
  monthly_budget      int not null,
  orientation         text not null default 'neutral' check (orientation in ('gc', 'one_day', 'neutral')),
  nationality         text,  -- e.g. 'FR', 'BE/NL', 'DK/NO', 'US/IT', null for T1-T2
  bonus_gc            int not null default 0,
  bonus_one_day       int not null default 0,
  bonus_stage         int not null default 0,
  gc_threshold        int not null default 25,
  one_day_threshold   int not null default 25,
  stage_threshold     int not null default 10,
  has_explicit_prestige boolean not null default false,
  bonus_monument      int,  -- T5-T6 only
  bonus_grand_tour    int,  -- T5-T6 only
  monument_threshold  int,  -- T5-T6 only
  grand_tour_threshold int, -- T5-T6 only
  sort_order          int not null default 0,
  created_at          timestamptz not null default now()
);

alter table public.sponsors enable row level security;
create policy "sponsors_read" on public.sponsors for select using (true);

-- ---------------------------------------------------------------------------
-- 3. Seed 13 sponsors
-- ---------------------------------------------------------------------------

-- T1 — Lotto (250K, Level 1, neutral)
insert into public.sponsors (name, slug, tier, unlock_level, monthly_budget, orientation, nationality,
  bonus_gc, bonus_one_day, bonus_stage, gc_threshold, one_day_threshold, stage_threshold,
  has_explicit_prestige, sort_order)
values ('Lotto', 'lotto', 1, 1, 250000, 'neutral', null,
  3000, 3000, 2000, 25, 25, 10, false, 10);

-- T2 — Astana (350K, Level 2, neutral)
insert into public.sponsors (name, slug, tier, unlock_level, monthly_budget, orientation, nationality,
  bonus_gc, bonus_one_day, bonus_stage, gc_threshold, one_day_threshold, stage_threshold,
  has_explicit_prestige, sort_order)
values ('Astana', 'astana', 2, 2, 350000, 'neutral', null,
  5000, 5000, 3000, 20, 20, 10, false, 20);

-- T3 — Groupama (FR), GC-oriented (450K, Level 3)
insert into public.sponsors (name, slug, tier, unlock_level, monthly_budget, orientation, nationality,
  bonus_gc, bonus_one_day, bonus_stage, gc_threshold, one_day_threshold, stage_threshold,
  has_explicit_prestige, sort_order)
values ('Groupama-FDJ', 'groupama', 3, 3, 450000, 'gc', 'FR',
  20000, 5000, 5000, 15, 15, 5, false, 30);

-- T3 — Movistar (ES), GC-oriented (450K, Level 3)
insert into public.sponsors (name, slug, tier, unlock_level, monthly_budget, orientation, nationality,
  bonus_gc, bonus_one_day, bonus_stage, gc_threshold, one_day_threshold, stage_threshold,
  has_explicit_prestige, sort_order)
values ('Movistar', 'movistar', 3, 3, 450000, 'gc', 'ES',
  20000, 5000, 5000, 15, 15, 5, false, 31);

-- T3 — Alpecin (BE/NL), One-Day-oriented (450K, Level 3)
insert into public.sponsors (name, slug, tier, unlock_level, monthly_budget, orientation, nationality,
  bonus_gc, bonus_one_day, bonus_stage, gc_threshold, one_day_threshold, stage_threshold,
  has_explicit_prestige, sort_order)
values ('Alpecin-Deceuninck', 'alpecin', 3, 3, 450000, 'one_day', 'BE/NL',
  5000, 10000, 5000, 15, 15, 5, false, 32);

-- T3 — Uno-X (DK/NO), One-Day-oriented (450K, Level 3)
insert into public.sponsors (name, slug, tier, unlock_level, monthly_budget, orientation, nationality,
  bonus_gc, bonus_one_day, bonus_stage, gc_threshold, one_day_threshold, stage_threshold,
  has_explicit_prestige, sort_order)
values ('Uno-X', 'unox', 3, 3, 450000, 'one_day', 'DK/NO',
  5000, 10000, 5000, 15, 15, 5, false, 33);

-- T4 — Ineos (GB), GC-oriented (650K, Level 5)
insert into public.sponsors (name, slug, tier, unlock_level, monthly_budget, orientation, nationality,
  bonus_gc, bonus_one_day, bonus_stage, gc_threshold, one_day_threshold, stage_threshold,
  has_explicit_prestige, sort_order)
values ('Ineos Grenadiers', 'ineos', 4, 5, 650000, 'gc', 'GB',
  40000, 10000, 10000, 10, 10, 3, false, 40);

-- T4 — Decathlon (FR), GC-oriented (650K, Level 5)
insert into public.sponsors (name, slug, tier, unlock_level, monthly_budget, orientation, nationality,
  bonus_gc, bonus_one_day, bonus_stage, gc_threshold, one_day_threshold, stage_threshold,
  has_explicit_prestige, sort_order)
values ('Decathlon AG2R', 'decathlon', 4, 5, 650000, 'gc', 'FR',
  40000, 10000, 10000, 10, 10, 3, false, 41);

-- T4 — Soudal Quick-Step (BE), One-Day-oriented (650K, Level 5)
insert into public.sponsors (name, slug, tier, unlock_level, monthly_budget, orientation, nationality,
  bonus_gc, bonus_one_day, bonus_stage, gc_threshold, one_day_threshold, stage_threshold,
  has_explicit_prestige, sort_order)
values ('Soudal Quick-Step', 'soudal', 4, 5, 650000, 'one_day', 'BE',
  10000, 20000, 10000, 10, 10, 3, false, 42);

-- T4 — Lidl-Trek (US/IT), One-Day-oriented (650K, Level 5)
insert into public.sponsors (name, slug, tier, unlock_level, monthly_budget, orientation, nationality,
  bonus_gc, bonus_one_day, bonus_stage, gc_threshold, one_day_threshold, stage_threshold,
  has_explicit_prestige, sort_order)
values ('Lidl-Trek', 'lidl-trek', 4, 5, 650000, 'one_day', 'US/IT',
  10000, 20000, 10000, 10, 10, 3, false, 43);

-- T5 — Visma (1M, Level 7) — "Le pari prestige"
insert into public.sponsors (name, slug, tier, unlock_level, monthly_budget, orientation, nationality,
  bonus_gc, bonus_one_day, bonus_stage, gc_threshold, one_day_threshold, stage_threshold,
  has_explicit_prestige, bonus_monument, bonus_grand_tour, monument_threshold, grand_tour_threshold,
  sort_order)
values ('Visma-Lease a Bike', 'visma', 5, 7, 1000000, 'gc', null,
  25000, 25000, 15000, 5, 5, 1,
  true, 75000, 75000, 3, 3,
  50);

-- T5 — Red Bull-Bora (1M, Level 7) — "Le régulier"
insert into public.sponsors (name, slug, tier, unlock_level, monthly_budget, orientation, nationality,
  bonus_gc, bonus_one_day, bonus_stage, gc_threshold, one_day_threshold, stage_threshold,
  has_explicit_prestige, bonus_monument, bonus_grand_tour, monument_threshold, grand_tour_threshold,
  sort_order)
values ('Red Bull-Bora', 'redbull-bora', 5, 7, 1000000, 'gc', null,
  30000, 30000, 15000, 5, 5, 1,
  true, 50000, 50000, 5, 5,
  51);

-- T6 — UAE Group (1.25M, Level 8) — Sponsor ultime
insert into public.sponsors (name, slug, tier, unlock_level, monthly_budget, orientation, nationality,
  bonus_gc, bonus_one_day, bonus_stage, gc_threshold, one_day_threshold, stage_threshold,
  has_explicit_prestige, bonus_monument, bonus_grand_tour, monument_threshold, grand_tour_threshold,
  sort_order)
values ('UAE Team Emirates', 'uae', 6, 8, 1250000, 'neutral', null,
  50000, 50000, 25000, 1, 1, 1,
  true, 100000, 100000, 3, 3,
  60);

-- ---------------------------------------------------------------------------
-- 4. Recreate team_sponsors (simplified — one sponsor per team)
-- ---------------------------------------------------------------------------
create table public.team_sponsors (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  sponsor_id    uuid not null references public.sponsors(id) on delete restrict,
  activated_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique(team_id)  -- one sponsor per team
);

alter table public.team_sponsors enable row level security;
create policy "team_sponsors_read" on public.team_sponsors
  for select using (true);
create policy "team_sponsors_write" on public.team_sponsors
  for all using (
    team_id in (select id from public.teams where user_id = auth.uid())
  );

-- Auto-assign Lotto (T1) for existing teams at level 1-2
insert into public.team_sponsors (team_id, sponsor_id)
select t.id, s.id
from public.teams t
cross join public.sponsors s
where s.slug = 'lotto'
  and t.level <= 2
  and not exists (select 1 from public.team_sponsors ts where ts.team_id = t.id);

-- ---------------------------------------------------------------------------
-- 5. Create sponsor_bonuses log table
-- ---------------------------------------------------------------------------
create table public.sponsor_bonuses (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  sponsor_id    uuid not null references public.sponsors(id) on delete restrict,
  rider_id      uuid not null references public.riders(id) on delete cascade,
  race_slug     text not null,
  race_date     date not null,
  result_type   text not null check (result_type in ('gc', 'one_day', 'monument', 'grand_tour', 'stage')),
  rider_rank    int not null,
  base_bonus    int not null,
  multiplier    numeric(3,1) not null default 1.0,
  final_bonus   int not null,
  created_at    timestamptz not null default now()
);

alter table public.sponsor_bonuses enable row level security;
create policy "sponsor_bonuses_read" on public.sponsor_bonuses
  for select using (true);

-- Index for fast lookups by team + date
create index idx_sponsor_bonuses_team_date on public.sponsor_bonuses(team_id, race_date);
-- Dedup index: one bonus per team per rider per race
create unique index idx_sponsor_bonuses_dedup on public.sponsor_bonuses(team_id, rider_id, race_slug, result_type);

-- ---------------------------------------------------------------------------
-- 6. Update treasury_log allowed types
-- ---------------------------------------------------------------------------
alter table public.treasury_log drop constraint if exists treasury_log_type_check;
alter table public.treasury_log add constraint treasury_log_type_check
  check (type in (
    'starting_fund',
    'auction_purchase',
    'monthly_salary',
    'daily_salary',
    'rider_revenue',
    'sponsor_payment',
    'daily_sponsor_base',
    'sponsor_bonus',
    'bankruptcy_release',
    'monthly_bonus'
  ));

-- ---------------------------------------------------------------------------
-- 7. Remove revenue_earned from rider_xp_daily (no longer used)
-- ---------------------------------------------------------------------------
alter table public.rider_xp_daily drop column if exists revenue_earned;
```

- [ ] **Step 1.1.2: Verify migration syntax**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && cat supabase/migrations/20260402300000_sponsors_rework.sql | head -5`
Expected: First 5 lines of the migration visible

- [ ] **Step 1.1.3: Commit**

```bash
git add supabase/migrations/20260402300000_sponsors_rework.sql
git commit -m "feat: sponsors rework migration — 13 sponsors, single-slot, bonus columns, sponsor_bonuses table"
```

---

## Task 2: Python — Sponsor Bonus Calculation (TDD)

**Files:**
- Create: `services/pcs-sync/sponsor_bonus.py`
- Create: `services/pcs-sync/tests/test_sponsor_bonus.py`

### Step 2.1: Write failing tests for result type classification

- [ ] **Step 2.1.1: Create test file with classification tests**

```python
"""Tests for sponsor_bonus.py — result type classification and bonus calculation."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from sponsor_bonus import classify_result_type, calculate_bonus, expand_sponsor_nationality


# ---------------------------------------------------------------------------
# classify_result_type
# ---------------------------------------------------------------------------

class TestClassifyResultType:
    """Classify a race_results row into one of 5 result types."""

    def test_monument_one_day(self):
        """Monument one-day race → 'monument'."""
        assert classify_result_type("monument", None, "race/milano-sanremo/2026") == "monument"

    def test_classic_one_day(self):
        """Classic one-day race → 'one_day'."""
        assert classify_result_type("classic", None, "race/strade-bianche/2026") == "one_day"

    def test_one_day_fallback(self):
        """Unclassified one-day race → 'one_day'."""
        assert classify_result_type(None, None, "race/some-race/2026") == "one_day"

    def test_stage_race_gc(self):
        """Stage race with no stage (= GC result) → 'gc'."""
        assert classify_result_type("stage_race", None, "race/paris-nice/2026") == "gc"

    def test_grand_tour_gc(self):
        """Grand tour with no stage (= GC result) → 'grand_tour'."""
        assert classify_result_type("grand_tour", None, "race/tour-de-france/2026") == "grand_tour"

    def test_stage_in_stage_race(self):
        """Stage result in a stage race → 'stage'."""
        assert classify_result_type("stage_race", "stage-3", "race/paris-nice/2026/stage-3") == "stage"

    def test_stage_in_grand_tour(self):
        """Stage result in a grand tour → 'stage'."""
        assert classify_result_type("grand_tour", "stage-7", "race/tour-de-france/2026/stage-7") == "stage"

    def test_stage_in_monument_impossible(self):
        """Monument has no stages — if stage is set, still classify as 'one_day' for safety."""
        assert classify_result_type("monument", "stage-1", "race/milano-sanremo/2026/stage-1") == "stage"
```

- [ ] **Step 2.1.2: Run tests to verify they fail**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && python3 -m pytest tests/test_sponsor_bonus.py -v`
Expected: ImportError — `sponsor_bonus` module not found

### Step 2.2: Implement classify_result_type

- [ ] **Step 2.2.1: Create sponsor_bonus.py with classification function**

```python
"""
Sponsor bonus calculation — WattHunter PCS Sync.

Calculates sponsor bonuses when race results are imported:
  1. Classify each result into a result_type (gc, one_day, monument, grand_tour, stage)
  2. Check if rider's rank qualifies for the team's sponsor bonus
  3. Apply multipliers (×2 prestige, ×1.5 nationality)
  4. Credit to treasury + log in sponsor_bonuses table

Design spec: docs/superpowers/specs/2026-04-02-sponsors-rework-design.md
"""
from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Grand tour slugs — used to detect ×2 stage multiplier
GRAND_TOUR_SLUGS = {"giro-d-italia", "tour-de-france", "vuelta-a-espana"}


def classify_result_type(
    race_class: Optional[str],
    stage: Optional[str],
    race_slug: str,
) -> str:
    """Classify a race_results row into a sponsor bonus result_type.

    Args:
        race_class: From race_results.race_class ('monument', 'classic', 'grand_tour', 'stage_race', None)
        stage: From race_results.stage ('stage-3' or None)
        race_slug: From race_results.race_slug (used for fallback classification)

    Returns:
        One of: 'gc', 'one_day', 'monument', 'grand_tour', 'stage'
    """
    # If stage is set, it's always a stage result (regardless of parent race type)
    if stage:
        return "stage"

    # GC or one-day result (no stage)
    if race_class == "monument":
        return "monument"
    if race_class == "grand_tour":
        return "grand_tour"
    if race_class == "stage_race":
        return "gc"
    # classic, one_day, or unclassified → one_day
    return "one_day"


def expand_sponsor_nationality(sponsor_nationality: Optional[str]) -> list[str]:
    """Expand compound nationality codes into individual codes.

    'BE/NL' → ['BE', 'NL']
    'DK/NO' → ['DK', 'NO']
    'US/IT' → ['US', 'IT']
    'FR' → ['FR']
    None → []
    """
    if not sponsor_nationality:
        return []
    return [c.strip() for c in sponsor_nationality.split("/")]
```

- [ ] **Step 2.2.2: Run classification tests**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && python3 -m pytest tests/test_sponsor_bonus.py::TestClassifyResultType -v`
Expected: All 8 tests PASS

- [ ] **Step 2.2.3: Commit**

```bash
git add services/pcs-sync/sponsor_bonus.py services/pcs-sync/tests/test_sponsor_bonus.py
git commit -m "feat: sponsor bonus — result type classification with tests"
```

### Step 2.3: Write failing tests for bonus calculation

- [ ] **Step 2.3.1: Add bonus calculation tests to test_sponsor_bonus.py**

Append to `tests/test_sponsor_bonus.py`:

```python
# ---------------------------------------------------------------------------
# expand_sponsor_nationality
# ---------------------------------------------------------------------------

class TestExpandNationality:

    def test_single(self):
        assert expand_sponsor_nationality("FR") == ["FR"]

    def test_compound(self):
        assert expand_sponsor_nationality("BE/NL") == ["BE", "NL"]

    def test_none(self):
        assert expand_sponsor_nationality(None) == []


# ---------------------------------------------------------------------------
# calculate_bonus — T1-T4 (3-line format with multipliers)
# ---------------------------------------------------------------------------

class TestCalculateBonusT1T4:
    """T1-T4 sponsors use bonus_gc/bonus_one_day/bonus_stage with ×2/×1.5 multipliers."""

    # Sponsor fixture: Lotto T1 (no nationality)
    LOTTO = {
        "bonus_gc": 3000, "bonus_one_day": 3000, "bonus_stage": 2000,
        "gc_threshold": 25, "one_day_threshold": 25, "stage_threshold": 10,
        "has_explicit_prestige": False,
        "bonus_monument": None, "bonus_grand_tour": None,
        "monument_threshold": None, "grand_tour_threshold": None,
        "nationality": None,
    }

    # Sponsor fixture: Groupama T3 (FR nationality, GC-oriented)
    GROUPAMA = {
        "bonus_gc": 20000, "bonus_one_day": 5000, "bonus_stage": 5000,
        "gc_threshold": 15, "one_day_threshold": 15, "stage_threshold": 5,
        "has_explicit_prestige": False,
        "bonus_monument": None, "bonus_grand_tour": None,
        "monument_threshold": None, "grand_tour_threshold": None,
        "nationality": "FR",
    }

    def test_lotto_gc_top25(self):
        """Lotto: GC Top 25 → 3K."""
        base, mult, final = calculate_bonus(self.LOTTO, "gc", 20, "BE", "race/paris-nice/2026")
        assert (base, mult, final) == (3000, 1.0, 3000)

    def test_lotto_gc_rank26_no_bonus(self):
        """Lotto: GC rank 26 → no bonus (threshold 25)."""
        base, mult, final = calculate_bonus(self.LOTTO, "gc", 26, "BE", "race/paris-nice/2026")
        assert final == 0

    def test_lotto_grand_tour_gc_x2(self):
        """Lotto: Grand Tour GC → ×2 multiplier on gc bonus."""
        base, mult, final = calculate_bonus(self.LOTTO, "grand_tour", 10, "BE", "race/tour-de-france/2026")
        assert (base, mult, final) == (3000, 2.0, 6000)

    def test_lotto_monument_x2(self):
        """Lotto: Monument → ×2 multiplier on one_day bonus."""
        base, mult, final = calculate_bonus(self.LOTTO, "monument", 5, "BE", "race/paris-roubaix/2026")
        assert (base, mult, final) == (3000, 2.0, 6000)

    def test_lotto_stage_top10(self):
        """Lotto: Stage Top 10 → 2K."""
        base, mult, final = calculate_bonus(self.LOTTO, "stage", 8, "BE", "race/paris-nice/2026/stage-3")
        assert (base, mult, final) == (2000, 1.0, 2000)

    def test_lotto_stage_grand_tour_x2(self):
        """Lotto: Stage in Grand Tour → ×2."""
        base, mult, final = calculate_bonus(self.LOTTO, "stage", 5, "BE", "race/tour-de-france/2026/stage-7")
        assert (base, mult, final) == (2000, 2.0, 4000)

    def test_lotto_no_nationality_bonus(self):
        """Lotto: T1 has no nationality → ×1.5 never applies."""
        base, mult, final = calculate_bonus(self.LOTTO, "one_day", 10, "BE", "race/strade-bianche/2026")
        assert mult == 1.0

    def test_groupama_nationality_match(self):
        """Groupama (FR): French rider → ×1.5."""
        base, mult, final = calculate_bonus(self.GROUPAMA, "gc", 10, "FR", "race/paris-nice/2026")
        assert (base, mult, final) == (20000, 1.5, 30000)

    def test_groupama_nationality_no_match(self):
        """Groupama (FR): Belgian rider → ×1.0."""
        base, mult, final = calculate_bonus(self.GROUPAMA, "gc", 10, "BE", "race/paris-nice/2026")
        assert (base, mult, final) == (20000, 1.0, 20000)

    def test_groupama_grand_tour_gc_x2_plus_nationality_x1_5(self):
        """Groupama: Grand Tour GC + French rider → ×2 × ×1.5 = ×3.0."""
        base, mult, final = calculate_bonus(self.GROUPAMA, "grand_tour", 5, "FR", "race/tour-de-france/2026")
        assert (base, mult, final) == (20000, 3.0, 60000)

    def test_groupama_monument_plus_nationality(self):
        """Groupama: Monument + French rider → ×2 × ×1.5 = ×3.0 on one_day bonus."""
        base, mult, final = calculate_bonus(self.GROUPAMA, "monument", 10, "FR", "race/paris-roubaix/2026")
        assert (base, mult, final) == (5000, 3.0, 15000)


# ---------------------------------------------------------------------------
# calculate_bonus — T5-T6 (explicit prestige, no nationality)
# ---------------------------------------------------------------------------

class TestCalculateBonusT5T6:
    """T5-T6 sponsors have explicit prestige amounts + different thresholds."""

    # Visma T5: "Le pari prestige"
    VISMA = {
        "bonus_gc": 25000, "bonus_one_day": 25000, "bonus_stage": 15000,
        "gc_threshold": 5, "one_day_threshold": 5, "stage_threshold": 1,
        "has_explicit_prestige": True,
        "bonus_monument": 75000, "bonus_grand_tour": 75000,
        "monument_threshold": 3, "grand_tour_threshold": 3,
        "nationality": None,
    }

    # Red Bull T5: "Le régulier"
    REDBULL = {
        "bonus_gc": 30000, "bonus_one_day": 30000, "bonus_stage": 15000,
        "gc_threshold": 5, "one_day_threshold": 5, "stage_threshold": 1,
        "has_explicit_prestige": True,
        "bonus_monument": 50000, "bonus_grand_tour": 50000,
        "monument_threshold": 5, "grand_tour_threshold": 5,
        "nationality": None,
    }

    # UAE T6
    UAE = {
        "bonus_gc": 50000, "bonus_one_day": 50000, "bonus_stage": 25000,
        "gc_threshold": 1, "one_day_threshold": 1, "stage_threshold": 1,
        "has_explicit_prestige": True,
        "bonus_monument": 100000, "bonus_grand_tour": 100000,
        "monument_threshold": 3, "grand_tour_threshold": 3,
        "nationality": None,
    }

    def test_visma_one_day_top5(self):
        """Visma: Classic Top 5 → 25K."""
        base, mult, final = calculate_bonus(self.VISMA, "one_day", 4, "BE", "race/strade-bianche/2026")
        assert (base, mult, final) == (25000, 1.0, 25000)

    def test_visma_monument_podium(self):
        """Visma: Monument Podium → 75K (explicit amount, not ×2 of one_day)."""
        base, mult, final = calculate_bonus(self.VISMA, "monument", 2, "BE", "race/paris-roubaix/2026")
        assert (base, mult, final) == (75000, 1.0, 75000)

    def test_visma_monument_4th_no_bonus(self):
        """Visma: Monument 4th → no bonus (threshold is podium = 3)."""
        base, mult, final = calculate_bonus(self.VISMA, "monument", 4, "BE", "race/paris-roubaix/2026")
        assert final == 0

    def test_visma_grand_tour_gc_podium(self):
        """Visma: Grand Tour GC Podium → 75K."""
        base, mult, final = calculate_bonus(self.VISMA, "grand_tour", 3, "FR", "race/tour-de-france/2026")
        assert (base, mult, final) == (75000, 1.0, 75000)

    def test_visma_stage_race_gc_top5(self):
        """Visma: Stage Race GC Top 5 → 25K."""
        base, mult, final = calculate_bonus(self.VISMA, "gc", 5, "FR", "race/paris-nice/2026")
        assert (base, mult, final) == (25000, 1.0, 25000)

    def test_visma_stage_win(self):
        """Visma: Stage win → 15K (threshold 1 = victory only)."""
        base, mult, final = calculate_bonus(self.VISMA, "stage", 1, "FR", "race/paris-nice/2026/stage-3")
        assert (base, mult, final) == (15000, 1.0, 15000)

    def test_visma_stage_2nd_no_bonus(self):
        """Visma: Stage 2nd → no bonus (threshold 1)."""
        base, mult, final = calculate_bonus(self.VISMA, "stage", 2, "FR", "race/paris-nice/2026/stage-3")
        assert final == 0

    def test_visma_stage_grand_tour_win_x2(self):
        """Visma: Stage win in Grand Tour → 15K × 2 = 30K."""
        base, mult, final = calculate_bonus(self.VISMA, "stage", 1, "FR", "race/tour-de-france/2026/stage-7")
        assert (base, mult, final) == (15000, 2.0, 30000)

    def test_redbull_monument_top5(self):
        """Red Bull: Monument Top 5 → 50K."""
        base, mult, final = calculate_bonus(self.REDBULL, "monument", 5, "BE", "race/paris-roubaix/2026")
        assert (base, mult, final) == (50000, 1.0, 50000)

    def test_redbull_grand_tour_top5(self):
        """Red Bull: Grand Tour GC Top 5 → 50K."""
        base, mult, final = calculate_bonus(self.REDBULL, "grand_tour", 4, "SI", "race/tour-de-france/2026")
        assert (base, mult, final) == (50000, 1.0, 50000)

    def test_uae_grand_tour_podium(self):
        """UAE: Grand Tour Podium → 100K."""
        base, mult, final = calculate_bonus(self.UAE, "grand_tour", 1, "SI", "race/tour-de-france/2026")
        assert (base, mult, final) == (100000, 1.0, 100000)

    def test_uae_one_day_victory(self):
        """UAE: Classic victory → 50K."""
        base, mult, final = calculate_bonus(self.UAE, "one_day", 1, "BE", "race/strade-bianche/2026")
        assert (base, mult, final) == (50000, 1.0, 50000)

    def test_uae_stage_grand_tour_x2(self):
        """UAE: Stage win in Grand Tour → 25K × 2 = 50K."""
        base, mult, final = calculate_bonus(self.UAE, "stage", 1, "BE", "race/giro-d-italia/2026/stage-10")
        assert (base, mult, final) == (25000, 2.0, 50000)

    def test_no_nationality_multiplier_t5_t6(self):
        """T5-T6: nationality never applies (even if set, has_explicit_prestige=True skips it)."""
        # Visma has no nationality, but even if it did, T5+ shouldn't use ×1.5
        base, mult, final = calculate_bonus(self.VISMA, "gc", 3, "NL", "race/paris-nice/2026")
        assert mult == 1.0
```

- [ ] **Step 2.3.2: Run tests to verify they fail**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && python3 -m pytest tests/test_sponsor_bonus.py -v`
Expected: ImportError for `calculate_bonus`

### Step 2.4: Implement calculate_bonus

- [ ] **Step 2.4.1: Add calculate_bonus to sponsor_bonus.py**

Append to `services/pcs-sync/sponsor_bonus.py`:

```python
def _is_grand_tour_stage(race_slug: str) -> bool:
    """Check if a stage race_slug belongs to a grand tour."""
    slug_lower = race_slug.lower()
    return any(gt in slug_lower for gt in GRAND_TOUR_SLUGS)


def calculate_bonus(
    sponsor: dict,
    result_type: str,
    rank: int,
    rider_nationality: str | None,
    race_slug: str,
) -> tuple[int, float, int]:
    """Calculate the sponsor bonus for a single race result.

    Args:
        sponsor: Sponsor row dict with bonus columns
        result_type: One of 'gc', 'one_day', 'monument', 'grand_tour', 'stage'
        rank: Rider's finishing position (1-based)
        rider_nationality: Rider's 2-letter country code (e.g. 'FR', 'BE')
        race_slug: Full race slug for grand tour stage detection

    Returns:
        (base_bonus, multiplier, final_bonus) — all ints except multiplier (float)
        Returns (0, 0.0, 0) if rank doesn't qualify
    """
    is_prestige = sponsor.get("has_explicit_prestige", False)

    # --- Determine base bonus and threshold ---
    if is_prestige:
        # T5-T6: explicit prestige amounts with separate thresholds
        base, threshold = _get_prestige_bonus(sponsor, result_type)
    else:
        # T1-T4: 3-line format — map result_type to bonus line
        base, threshold = _get_standard_bonus(sponsor, result_type)

    # Check rank qualification
    if base == 0 or threshold == 0 or rank > threshold:
        return (0, 0.0, 0)

    # --- Calculate multiplier ---
    multiplier = 1.0

    if is_prestige:
        # T5-T6: only ×2 for grand tour stages, no nationality
        if result_type == "stage" and _is_grand_tour_stage(race_slug):
            multiplier *= 2.0
    else:
        # T1-T4: ×2 for prestige events, ×1.5 for nationality match
        if result_type == "grand_tour":
            multiplier *= 2.0
        elif result_type == "monument":
            multiplier *= 2.0
        elif result_type == "stage" and _is_grand_tour_stage(race_slug):
            multiplier *= 2.0

        # Nationality multiplier (T1-T4 only)
        sponsor_nat = sponsor.get("nationality")
        if sponsor_nat and rider_nationality:
            nat_codes = expand_sponsor_nationality(sponsor_nat)
            if rider_nationality.upper() in [c.upper() for c in nat_codes]:
                multiplier *= 1.5

    final = int(base * multiplier)
    return (base, multiplier, final)


def _get_standard_bonus(sponsor: dict, result_type: str) -> tuple[int, int]:
    """T1-T4: map result_type to the 3-line bonus format.

    gc/grand_tour → bonus_gc line (grand_tour gets ×2 via multiplier)
    one_day/monument → bonus_one_day line (monument gets ×2 via multiplier)
    stage → bonus_stage line
    """
    if result_type in ("gc", "grand_tour"):
        return (sponsor.get("bonus_gc", 0), sponsor.get("gc_threshold", 0))
    elif result_type in ("one_day", "monument"):
        return (sponsor.get("bonus_one_day", 0), sponsor.get("one_day_threshold", 0))
    elif result_type == "stage":
        return (sponsor.get("bonus_stage", 0), sponsor.get("stage_threshold", 0))
    return (0, 0)


def _get_prestige_bonus(sponsor: dict, result_type: str) -> tuple[int, int]:
    """T5-T6: explicit prestige amounts with separate thresholds."""
    if result_type == "monument":
        return (sponsor.get("bonus_monument", 0) or 0, sponsor.get("monument_threshold", 0) or 0)
    elif result_type == "grand_tour":
        return (sponsor.get("bonus_grand_tour", 0) or 0, sponsor.get("grand_tour_threshold", 0) or 0)
    elif result_type == "gc":
        return (sponsor.get("bonus_gc", 0), sponsor.get("gc_threshold", 0))
    elif result_type == "one_day":
        return (sponsor.get("bonus_one_day", 0), sponsor.get("one_day_threshold", 0))
    elif result_type == "stage":
        return (sponsor.get("bonus_stage", 0), sponsor.get("stage_threshold", 0))
    return (0, 0)
```

- [ ] **Step 2.4.2: Run all bonus tests**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && python3 -m pytest tests/test_sponsor_bonus.py -v`
Expected: All tests PASS

- [ ] **Step 2.4.3: Commit**

```bash
git add services/pcs-sync/sponsor_bonus.py services/pcs-sync/tests/test_sponsor_bonus.py
git commit -m "feat: sponsor bonus calculation — T1-T4 multipliers + T5-T6 explicit prestige"
```

### Step 2.5: Write failing tests for process_race_bonuses (integration with Supabase)

- [ ] **Step 2.5.1: Add process_race_bonuses tests**

Append to `tests/test_sponsor_bonus.py`:

```python
from helpers import make_supabase

# ---------------------------------------------------------------------------
# process_race_bonuses (mocked Supabase)
# ---------------------------------------------------------------------------

TEAM_ID = "aaaa-0000-0000-0001"
RIDER_ID = "bbbb-0000-0000-0001"
SPONSOR_ID = "ssss-0000-0000-0001"
CONTRACT_ID = "cccc-0000-0000-0001"


class TestProcessRaceBonuses:

    @pytest.mark.asyncio
    async def test_qualifying_result_creates_bonus(self):
        """Rider with top-25 GC result and Lotto sponsor → bonus credited."""
        from sponsor_bonus import process_race_bonuses

        sb = make_supabase(
            # 1. race_results for these slugs
            [{"rider_id": RIDER_ID, "race_slug": "race/paris-nice/2026",
              "race_class": "stage_race", "stage": None, "rank": 10,
              "pcs_points": 50, "race_date": "2026-03-15"}],
            # 2. contracts (active, with rider nationality)
            [{"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
              "purchased_at": "2026-01-01", "release_date": None,
              "riders": {"nationality": "BE"}}],
            # 3. team_sponsors (with full sponsor data)
            [{"team_id": TEAM_ID, "sponsor_id": SPONSOR_ID,
              "sponsors": {"id": SPONSOR_ID, "bonus_gc": 3000, "bonus_one_day": 3000, "bonus_stage": 2000,
                           "gc_threshold": 25, "one_day_threshold": 25, "stage_threshold": 10,
                           "has_explicit_prestige": False,
                           "bonus_monument": None, "bonus_grand_tour": None,
                           "monument_threshold": None, "grand_tour_threshold": None,
                           "nationality": None}}],
            # 4. sponsor_bonuses upsert
            [],
            # 5. teams select (treasury)
            {"id": TEAM_ID, "treasury": 500000},
            # 6. teams update
            [],
            # 7. treasury_log insert
            [],
        )

        result = await process_race_bonuses(sb, ["race/paris-nice/2026"])

        assert result["status"] == "completed"
        assert result["bonuses_created"] >= 1

    @pytest.mark.asyncio
    async def test_no_qualifying_results(self):
        """Rider rank 30 with Lotto (threshold 25) → no bonus."""
        from sponsor_bonus import process_race_bonuses

        sb = make_supabase(
            # 1. race_results — rank 30 (below threshold)
            [{"rider_id": RIDER_ID, "race_slug": "race/paris-nice/2026",
              "race_class": "stage_race", "stage": None, "rank": 30,
              "pcs_points": 5, "race_date": "2026-03-15"}],
            # 2. contracts
            [{"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
              "purchased_at": "2026-01-01", "release_date": None,
              "riders": {"nationality": "BE"}}],
            # 3. team_sponsors
            [{"team_id": TEAM_ID, "sponsor_id": SPONSOR_ID,
              "sponsors": {"id": SPONSOR_ID, "bonus_gc": 3000, "bonus_one_day": 3000, "bonus_stage": 2000,
                           "gc_threshold": 25, "one_day_threshold": 25, "stage_threshold": 10,
                           "has_explicit_prestige": False,
                           "bonus_monument": None, "bonus_grand_tour": None,
                           "monument_threshold": None, "grand_tour_threshold": None,
                           "nationality": None}}],
        )

        result = await process_race_bonuses(sb, ["race/paris-nice/2026"])

        assert result["status"] == "completed"
        assert result["bonuses_created"] == 0
```

- [ ] **Step 2.5.2: Run to verify failure**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && python3 -m pytest tests/test_sponsor_bonus.py::TestProcessRaceBonuses -v`
Expected: ImportError for `process_race_bonuses`

### Step 2.6: Implement process_race_bonuses

- [ ] **Step 2.6.1: Add process_race_bonuses to sponsor_bonus.py**

Append to `services/pcs-sync/sponsor_bonus.py`:

```python
from supabase import Client


async def process_race_bonuses(
    supabase: Client,
    race_slugs: list[str],
) -> dict:
    """Calculate and credit sponsor bonuses for race results.

    Called after post-race sync. For each contracted rider with a result
    in the given race_slugs:
      1. Classify result type
      2. Look up team's sponsor
      3. Calculate bonus (if qualifying rank)
      4. Upsert sponsor_bonuses row
      5. Credit team treasury + treasury_log

    Returns summary dict with bonuses_created count.
    """
    bonuses_created = 0
    errors = []

    # 1. Fetch race results for these slugs (need rank + race_class + stage)
    results = supabase.table("race_results").select(
        "rider_id, race_slug, race_class, stage, rank, pcs_points, race_date"
    ).in_("race_slug", race_slugs).execute()

    if not results.data:
        return {"status": "completed", "bonuses_created": 0, "message": "No race results"}

    # 2. Get all active contracts (with rider nationality)
    contracts = supabase.table("contracts").select(
        "id, team_id, rider_id, purchased_at, release_date, "
        "riders:rider_id(nationality)"
    ).in_("status", ["active", "notice"]).execute()

    if not contracts.data:
        return {"status": "completed", "bonuses_created": 0, "message": "No active contracts"}

    # Build rider→team+nationality map
    rider_teams: dict[str, list[dict]] = {}
    for c in contracts.data:
        rider_teams.setdefault(c["rider_id"], []).append(c)

    # 3. Get all team_sponsors with full sponsor data
    team_sponsors = supabase.table("team_sponsors").select(
        "team_id, sponsor_id, sponsors(*)"
    ).execute()

    # Build team→sponsor map
    team_sponsor_map: dict[str, dict] = {}
    for ts in (team_sponsors.data or []):
        sponsor_data = ts.get("sponsors") or {}
        if isinstance(sponsor_data, list):
            sponsor_data = sponsor_data[0] if sponsor_data else {}
        team_sponsor_map[ts["team_id"]] = {
            "sponsor_id": ts["sponsor_id"],
            **sponsor_data,
        }

    # 4. Process each result
    team_bonus_totals: dict[str, int] = {}

    for result in results.data:
        rider_id = result["rider_id"]
        if rider_id not in rider_teams:
            continue

        result_type = classify_result_type(
            result.get("race_class"),
            result.get("stage"),
            result["race_slug"],
        )

        for contract in rider_teams[rider_id]:
            team_id = contract["team_id"]
            sponsor = team_sponsor_map.get(team_id)
            if not sponsor:
                continue

            # Extract rider nationality
            rider_join = contract.get("riders") or {}
            if isinstance(rider_join, list):
                rider_join = rider_join[0] if rider_join else {}
            rider_nat = rider_join.get("nationality")

            base, mult, final = calculate_bonus(
                sponsor, result_type, result["rank"], rider_nat, result["race_slug"]
            )

            if final == 0:
                continue

            # Upsert sponsor_bonuses (dedup by team+rider+race+type)
            try:
                supabase.table("sponsor_bonuses").upsert({
                    "team_id": team_id,
                    "sponsor_id": sponsor["sponsor_id"],
                    "rider_id": rider_id,
                    "race_slug": result["race_slug"],
                    "race_date": result.get("race_date"),
                    "result_type": result_type,
                    "rider_rank": result["rank"],
                    "base_bonus": base,
                    "multiplier": mult,
                    "final_bonus": final,
                }, on_conflict="team_id,rider_id,race_slug,result_type").execute()

                team_bonus_totals[team_id] = team_bonus_totals.get(team_id, 0) + final
                bonuses_created += 1

            except Exception as e:
                logger.error(f"sponsor_bonuses upsert failed: {e}")
                errors.append(str(e))

    # 5. Credit team treasuries
    for team_id, total_bonus in team_bonus_totals.items():
        try:
            team = supabase.table("teams").select("id, treasury").eq(
                "id", team_id
            ).single().execute()

            if team.data:
                new_treasury = team.data["treasury"] + total_bonus
                supabase.table("teams").update(
                    {"treasury": new_treasury}
                ).eq("id", team_id).execute()

                supabase.table("treasury_log").insert({
                    "team_id": team_id,
                    "type": "sponsor_bonus",
                    "amount": total_bonus,
                    "description": f"Sponsor bonus — {bonuses_created} result(s)",
                }).execute()

        except Exception as e:
            logger.error(f"Treasury update failed for team {team_id}: {e}")
            errors.append(str(e))

    return {
        "status": "completed",
        "bonuses_created": bonuses_created,
        "errors": errors,
    }
```

- [ ] **Step 2.6.2: Run all tests**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && python3 -m pytest tests/test_sponsor_bonus.py -v`
Expected: All tests PASS

- [ ] **Step 2.6.3: Commit**

```bash
git add services/pcs-sync/sponsor_bonus.py services/pcs-sync/tests/test_sponsor_bonus.py
git commit -m "feat: process_race_bonuses — credits sponsor bonuses on race results"
```

---

## Task 3: Python — Strip Treasury from Scoring (XP Only)

**Files:**
- Modify: `services/pcs-sync/scoring.py`
- Modify: `services/pcs-sync/tests/test_scoring.py`

### Step 3.1: Update scoring.py — remove revenue logic

- [ ] **Step 3.1.1: Remove CONVERSION_RATE, calculate_rider_bonus, and all revenue/treasury logic**

In `services/pcs-sync/scoring.py`, make these changes:

1. **Delete lines 22-24** (CONVERSION_RATE):
```python
# DELETE THIS:
CONVERSION_RATE = int(os.getenv("CONVERSION_RATE_EUR_PER_PCS", "1500"))
```

2. **Delete lines 38-44** (calculate_rider_bonus function):
```python
# DELETE THIS ENTIRE FUNCTION:
def calculate_rider_bonus(pcs_points: int, locked_salary: int, conversion_rate: int) -> int:
    ...
```

3. **Delete line 117** (conversion_rate re-read):
```python
# DELETE THIS:
conversion_rate = int(os.getenv("CONVERSION_RATE_EUR_PER_PCS", "1500"))
```

4. **In the contract select (line 165-168)**, remove `locked_salary` from select — it's no longer needed for scoring:
```python
# Change FROM:
contracts = supabase.table("contracts").select(
    "id, team_id, rider_id, locked_salary, purchased_at, release_date, "
    "riders:rider_id(specialty, nationality, real_team, birthdate)"
).in_("status", ["active", "notice"]).execute()

# Change TO:
contracts = supabase.table("contracts").select(
    "id, team_id, rider_id, purchased_at, release_date, "
    "riders:rider_id(specialty, nationality, real_team, birthdate)"
).in_("status", ["active", "notice"]).execute()
```

5. **Delete prev_team_revenue tracking** (lines 154, 162):
```python
# DELETE THESE:
prev_team_revenue: dict[str, int] = {}
# and inside the loop:
prev_team_revenue[tid] = prev_team_revenue.get(tid, 0) + int(row.get("revenue_earned") or 0)
```

6. **Remove revenue from the inner loop** (lines 206, 229, 250-251, 271):
```python
# DELETE: total_revenue = 0
# DELETE: contract_salary = contract.get("locked_salary", 0)
# DELETE: revenue = calculate_rider_bonus(raw_points, contract_salary, conversion_rate)
# CHANGE upsert to remove revenue_earned:
supabase.table("rider_xp_daily").upsert({
    "team_id": team_id,
    "rider_id": rider_id,
    "contract_id": contract["id"],
    "date": entry.get("race_date", today),
    "raw_pcs_points": raw_points,
    "policy_bonus": bonus,
    "xp_gained": round(xp, 2),
    "race_slug": race_slug,
}, on_conflict="team_id,rider_id,race_slug").execute()
# DELETE: total_revenue += revenue
```

7. **Remove treasury update from team update** (lines 273-291, 297-305, 311-324):
```python
# Change the early return check FROM:
if total_xp == 0 and total_revenue == 0:
    continue
# TO:
if total_xp == 0:
    continue

# Remove delta_revenue, new_treasury calculations
# Change team update FROM:
update_data: dict = {
    "cumulative_xp": new_xp,
    "treasury": new_treasury,
}
# TO:
update_data: dict = {
    "cumulative_xp": new_xp,
}

# DELETE the entire treasury_log insert block (dedup check + insert)
```

8. **Remove `os` import** if no longer needed (check if anything else uses it — `os` is no longer needed after removing CONVERSION_RATE).

Wait — `os` might still be used. Keep the import but remove the CONVERSION_RATE usage.

- [ ] **Step 3.1.2: Update test_scoring.py**

In `services/pcs-sync/tests/test_scoring.py`:

1. **Remove CONVERSION_RATE monkeypatch** from all async tests — no longer needed.

2. **Remove revenue formula tests** (test_revenue_formula, test_bonus_positive_only).

3. **Update make_supabase call counts** — scoring no longer calls treasury_log or teams.update with treasury. Reduce the number of mock responses accordingly.

For `test_nominal_processing`, the mock chain becomes:
```python
async def test_nominal_processing():
    """One team with one rider scoring → teams_processed=1, no errors."""
    import scoring
    importlib.reload(scoring)

    sb = make_supabase(
        # 1. race_results
        [{"rider_id": RIDER_ID, "race_slug": "race/test/2026", "pcs_points": 20, "race_date": "2026-03-15"}],
        # 2. contracts (with riders join for policy matching)
        [{"id": CONTRACT_ID, "team_id": TEAM_ID, "rider_id": RIDER_ID,
          "purchased_at": "2026-01-01T00:00:00Z", "release_date": None,
          "riders": {"specialty": "GC", "nationality": "BE", "real_team": "Soudal", "birthdate": "1998-01-01"}}],
        # 3. team_policies (none active)
        [],
        # 4. rider_xp_daily upsert (result unused)
        [],
        # 5. teams select — current cumulative_xp + level + league_id
        {"id": TEAM_ID, "cumulative_xp": 0, "level": 1, "league_id": "lg-1"},
        # 6. teams update (result unused)
        [],
        # 7. league teams for snapshot
        [{"id": TEAM_ID, "cumulative_xp": 20}],
        # 8. team_ranking_daily upsert
        [],
    )

    result = await scoring.calculate_daily_scores(sb)

    assert result["status"] == "completed"
    assert result["teams_processed"] == 1
    assert result["errors"] == []
```

Similarly update `test_nominal_processing_with_policy_bonus`, `test_race_before_contract_is_skipped`, `test_race_after_release_is_skipped`, `test_race_on_purchase_day_is_scored`.

- [ ] **Step 3.1.3: Run updated tests**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && python3 -m pytest tests/test_scoring.py -v`
Expected: All remaining tests PASS

- [ ] **Step 3.1.4: Commit**

```bash
git add services/pcs-sync/scoring.py services/pcs-sync/tests/test_scoring.py
git commit -m "refactor: scoring.py — remove treasury/revenue logic, keep XP only"
```

---

## Task 4: Python — Phase Finance (Replace Monthly)

**Files:**
- Create: `services/pcs-sync/phase_finance.py`
- Create: `services/pcs-sync/tests/test_phase_finance.py`

### Step 4.1: Write failing tests for phase finance

- [ ] **Step 4.1.1: Create test file**

```python
"""Tests for phase_finance.py — phase-based sponsor income + salary deduction + bankruptcy."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from phase_finance import calculate_phase_salaries


# ---------------------------------------------------------------------------
# Phase salary deduction (full monthly amounts, not /30)
# ---------------------------------------------------------------------------

class TestPhaseSalaries:

    def test_single_contract(self):
        """One rider at 60K/month → 60000 per phase."""
        contracts = [{"locked_salary": 60000}]
        assert calculate_phase_salaries(contracts) == 60000

    def test_multiple_contracts(self):
        """Two riders: 60K + 30K → 90000 per phase."""
        contracts = [{"locked_salary": 60000}, {"locked_salary": 30000}]
        assert calculate_phase_salaries(contracts) == 90000

    def test_no_contracts(self):
        """No contracts → 0."""
        assert calculate_phase_salaries([]) == 0

    def test_minimum_salary(self):
        """Min salary 5K → 5000 per phase."""
        contracts = [{"locked_salary": 5000}]
        assert calculate_phase_salaries(contracts) == 5000
```

- [ ] **Step 4.1.2: Run to verify failure**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && python3 -m pytest tests/test_phase_finance.py -v`
Expected: ImportError

### Step 4.2: Implement phase_finance.py

- [ ] **Step 4.2.1: Create the phase finance module**

```python
"""
Phase finance job — WattHunter.

Runs once per WT phase (8 phases per season, triggered manually via pipeline):
  1. +sponsor base income (monthly_budget — full amount, same every phase)
  2. -salaries (sum of locked_salary — full monthly amounts)
  3. Bankruptcy check: if treasury < 0, release best scorers

Replaces the old monthly_finance.py. No /30 division — same fixed amount per phase.

Design spec: docs/superpowers/specs/2026-04-02-sponsors-rework-design.md
"""
from __future__ import annotations

import logging
from datetime import date
from supabase import Client

logger = logging.getLogger(__name__)

DEFAULT_SPONSOR_INCOME = 250_000  # Lotto T1 fallback if no sponsor assigned


def calculate_phase_salaries(contracts: list[dict]) -> int:
    """Phase salary cost = sum of all locked_salary (full monthly amounts)."""
    return sum(c.get("locked_salary", 0) for c in contracts)


def get_release_order(contracts: list[dict]) -> list[dict]:
    """Order contracts by total_xp descending — best scorer released first."""
    return sorted(contracts, key=lambda c: -c.get("total_xp", 0))


async def run_phase_finance(supabase: Client) -> dict:
    """
    Phase finance cycle for all teams in active leagues:
      1. +sponsor base income (monthly_budget, full amount per phase)
      2. -salaries (sum of locked_salary per phase)
      3. Bankruptcy check → release best scorers
    """
    today = date.today().isoformat()
    results = []

    # Only process teams in active leagues
    teams = supabase.table("teams").select(
        "id, treasury, name, league_id, leagues(status)"
    ).execute()

    if not teams.data:
        return {"status": "no_teams"}

    active_teams = [
        t for t in teams.data
        if (t.get("leagues") or {}).get("status") == "active"
    ]

    if not active_teams:
        return {"status": "no_active_leagues", "total_teams": len(teams.data)}

    for team in active_teams:
        team_id = team["id"]
        treasury = team["treasury"]

        try:
            # 1. Sponsor income (full monthly_budget per phase)
            ts = supabase.table("team_sponsors").select(
                "sponsor_id, sponsors(name, monthly_budget)"
            ).eq("team_id", team_id).execute()

            sponsor_data = None
            if ts.data:
                raw = ts.data[0].get("sponsors") or {}
                if isinstance(raw, list):
                    raw = raw[0] if raw else {}
                sponsor_data = raw

            if sponsor_data:
                phase_income = sponsor_data.get("monthly_budget", 0)
                sponsor_name = sponsor_data.get("name", "Unknown")
            else:
                phase_income = DEFAULT_SPONSOR_INCOME
                sponsor_name = "Default (Lotto)"

            treasury += phase_income
            supabase.table("treasury_log").insert({
                "team_id": team_id,
                "type": "phase_sponsor_base",
                "amount": phase_income,
                "description": f"Phase sponsor — {sponsor_name}",
            }).execute()

            # 2. Salary deduction (full monthly amounts per phase)
            contracts = supabase.table("contracts").select(
                "id, rider_id, locked_salary"
            ).eq("team_id", team_id).in_(
                "status", ["active", "notice"]
            ).execute()

            phase_salary = calculate_phase_salaries(contracts.data or [])
            treasury -= phase_salary

            if phase_salary > 0:
                supabase.table("treasury_log").insert({
                    "team_id": team_id,
                    "type": "phase_salary",
                    "amount": -phase_salary,
                    "description": f"Phase salaries ({len(contracts.data or [])} riders)",
                }).execute()

            # 3. Update treasury
            supabase.table("teams").update({
                "treasury": treasury,
            }).eq("id", team_id).execute()

            # 4. Bankruptcy check
            released = []
            if treasury < 0 and contracts.data:
                xp_data = supabase.table("rider_xp_daily").select(
                    "rider_id, xp_gained"
                ).eq("team_id", team_id).execute()

                rider_xp: dict[str, int] = {}
                for row in (xp_data.data or []):
                    rid = row["rider_id"]
                    rider_xp[rid] = rider_xp.get(rid, 0) + row["xp_gained"]

                enriched = [{**c, "total_xp": rider_xp.get(c["rider_id"], 0)}
                            for c in contracts.data]

                for contract in get_release_order(enriched):
                    if treasury >= 0:
                        break

                    supabase.table("contracts").update({
                        "status": "released",
                        "release_date": today,
                    }).eq("id", contract["id"]).execute()

                    treasury += contract["locked_salary"]
                    released.append(contract["rider_id"])

                    supabase.table("treasury_log").insert({
                        "team_id": team_id,
                        "type": "bankruptcy_release",
                        "amount": 0,
                        "description": f"Bankruptcy — released rider {contract['rider_id']}",
                        "rider_id": contract["rider_id"],
                    }).execute()

                supabase.table("teams").update({
                    "treasury": treasury,
                }).eq("id", team_id).execute()

            results.append({
                "team_id": team_id,
                "phase_income": phase_income,
                "phase_salary": phase_salary,
                "treasury_after": treasury,
                "released": released,
            })

        except Exception as e:
            logger.error(f"Phase finance failed for team {team_id}: {e}")
            results.append({"team_id": team_id, "error": str(e)})

    # Treasury validation
    from validation import validate_treasury
    validation = await validate_treasury(supabase)
    if validation.get("divergences"):
        logger.warning(f"Treasury validation: {len(validation['divergences'])} divergences")

    return {"status": "completed", "teams": results, "validation": validation}
```

- [ ] **Step 4.2.2: Run tests**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && python3 -m pytest tests/test_phase_finance.py -v`
Expected: All tests PASS

- [ ] **Step 4.2.3: Commit**

```bash
git add services/pcs-sync/phase_finance.py services/pcs-sync/tests/test_phase_finance.py
git commit -m "feat: phase_finance.py — phase-based sponsor income + salary deduction + bankruptcy"
```

---

## Task 5: Python — Wire Pipeline Commands

**Files:**
- Modify: `services/pcs-sync/run_pipeline.py`
- Modify: `services/pcs-sync/main.py`

### Step 5.1: Update run_pipeline.py

- [ ] **Step 5.1.1: Replace monthly-finance with phase-finance command**

In `services/pcs-sync/run_pipeline.py`, find the `monthly-finance` subcommand handler and replace it:

```python
# In the argparse setup, CHANGE:
#   subparsers.add_parser("monthly-finance", ...)
# TO:
sub_daily = subparsers.add_parser("phase-finance", help="Daily sponsor base income + salary deduction")

# Keep monthly-finance as deprecated alias:
sub_monthly = subparsers.add_parser("monthly-finance", help="[DEPRECATED] Use phase-finance instead")
```

In the main dispatch, add the phase-finance handler and update post-race to call sponsor bonuses:

```python
# In the post-race handler, AFTER calling calculate_daily_scores():
# Add sponsor bonus processing
from sponsor_bonus import process_race_bonuses
bonus_result = await process_race_bonuses(supabase, race_slugs)
print(f"  Sponsor bonuses: {bonus_result.get('bonuses_created', 0)} bonuses credited")

# For phase-finance command:
elif args.command == "phase-finance" or args.command == "monthly-finance":
    if args.command == "monthly-finance":
        print("⚠️  monthly-finance is deprecated — use phase-finance instead")
    from phase_finance import run_phase_finance
    result = await run_phase_finance(supabase)
    print(f"Phase finance: {len(result.get('teams', []))} teams processed")
```

- [ ] **Step 5.1.2: Update pre-auction to use phase-finance**

In the `pre-auction` handler, replace the `monthly_finance` import with `phase_finance`:

```python
# CHANGE FROM:
from monthly_finance import run_monthly_finance
finance_result = await run_monthly_finance(supabase)
# TO:
from phase_finance import run_phase_finance
finance_result = await run_phase_finance(supabase)
```

### Step 5.2: Update main.py

- [ ] **Step 5.2.1: Add phase-finance endpoint and sponsor bonus to daily-scoring**

In `services/pcs-sync/main.py`:

```python
# Add import at top:
from phase_finance import run_phase_finance
from sponsor_bonus import process_race_bonuses

# Update daily-scoring endpoint docstring:
@app.post("/jobs/daily-scoring")
async def job_daily_scoring(
    request: Request,
    x_api_secret: Optional[str] = Header(default=None),
):
    """
    Calculate daily XP for all teams with contracted riders who earned PCS points today.
    Treasury is no longer updated here — use /jobs/phase-finance for income/salary.
    """
    _check_auth(x_api_secret)
    result = await calculate_daily_scores(_supabase)
    return JSONResponse(content=result)


# Add new endpoint:
@app.post("/jobs/phase-finance")
async def job_phase_finance(
    request: Request,
    x_api_secret: Optional[str] = Header(default=None),
):
    """
    Phase finance: +sponsor base income, -salaries, bankruptcy check.
    Run once per day (replaces monthly-finance).
    """
    _check_auth(x_api_secret)
    result = await run_phase_finance(_supabase)
    return JSONResponse(content=result)
```

- [ ] **Step 5.2.2: Run existing test suite to verify nothing is broken**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && python3 -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 5.2.3: Commit**

```bash
git add services/pcs-sync/run_pipeline.py services/pcs-sync/main.py
git commit -m "feat: wire phase-finance + sponsor bonuses into pipeline and API"
```

---

## Task 6: Frontend — Types and Levels

**Files:**
- Modify: `apps/web/lib/sponsors.ts`
- Modify: `apps/web/lib/levels.ts`

### Step 6.1: Rewrite sponsors.ts types

- [ ] **Step 6.1.1: Replace SponsorRow and remove eligibility types**

Replace the entire content of `apps/web/lib/sponsors.ts` with:

```typescript
/**
 * Sponsor types and helpers — v2 (simplified model).
 *
 * 1 sponsor per team, level-gated only, no eligibility conditions.
 * Design spec: docs/superpowers/specs/2026-04-02-sponsors-rework-design.md
 */

export interface SponsorRow {
  id: string;
  name: string;
  slug: string;
  tier: number;
  unlock_level: number;
  monthly_budget: number;
  orientation: "gc" | "one_day" | "neutral";
  nationality: string | null;
  bonus_gc: number;
  bonus_one_day: number;
  bonus_stage: number;
  gc_threshold: number;
  one_day_threshold: number;
  stage_threshold: number;
  has_explicit_prestige: boolean;
  bonus_monument: number | null;
  bonus_grand_tour: number | null;
  monument_threshold: number | null;
  grand_tour_threshold: number | null;
  sort_order: number;
}

export interface TeamSponsor {
  id: string;
  team_id: string;
  sponsor_id: string;
  activated_at: string;
  sponsors?: SponsorRow;
}

/**
 * Expand compound nationality codes for display.
 * 'BE/NL' → ['BE', 'NL'], 'FR' → ['FR'], null → []
 */
export function expandNationality(code: string | null): string[] {
  if (!code) return [];
  return code.split("/").map((c) => c.trim());
}

/**
 * Format sponsor tier label for display.
 */
export function tierLabel(tier: number): string {
  return `Tier ${tier}`;
}

/**
 * Format monthly budget as compact string: "250K", "1M", "1.25M"
 */
export function formatBudget(monthly: number): string {
  if (monthly >= 1_000_000) {
    const m = monthly / 1_000_000;
    return m === Math.floor(m) ? `${m}M` : `${m}M`;
  }
  return `${Math.round(monthly / 1000)}K`;
}

/**
 * Threshold label for display: 1 → "Victory", 3 → "Podium", N → "Top N"
 */
export function thresholdLabel(threshold: number): string {
  if (threshold === 1) return "Victory";
  if (threshold === 3) return "Podium";
  return `Top ${threshold}`;
}
```

### Step 6.2: Update levels.ts sponsor descriptions

- [ ] **Step 6.2.1: Update LEVELS array with new sponsor tiers**

In `apps/web/lib/levels.ts`, update the `sponsor` field in the LEVELS array:

```typescript
export const LEVELS = [
  { level: 1, xp: 0, slots: 6, pool: "#300-600", poolMin: 300, policy: "Speciality", maxActive: 1, sponsor: "Lotto · 250K" },
  { level: 2, xp: 25, slots: 7, pool: "#200-600", poolMin: 200, policy: null, maxActive: 1, sponsor: "Astana · 350K" },
  { level: 3, xp: 150, slots: 8, pool: "#100-600", poolMin: 100, policy: "Nationality", maxActive: 2, sponsor: "T3 · 450K (×4)" },
  { level: 4, xp: 350, slots: 9, pool: "#30-600", poolMin: 30, policy: null, maxActive: 2, sponsor: null },
  { level: 5, xp: 600, slots: 10, pool: "#20-600", poolMin: 20, policy: "Teams", maxActive: 2, sponsor: "T4 · 650K (×4)" },
  { level: 6, xp: 900, slots: 11, pool: "#10-600", poolMin: 10, policy: null, maxActive: 2, sponsor: null },
  { level: 7, xp: 1500, slots: 12, pool: "#4-600", poolMin: 4, policy: "Age", maxActive: 3, sponsor: "T5 · 1M (×2)" },
  { level: 8, xp: 2000, slots: 12, pool: "#1-600", poolMin: 1, policy: null, maxActive: 3, sponsor: "T6 UAE · 1.25M" },
] as const;
```

- [ ] **Step 6.2.2: Run typecheck**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm typecheck`
Expected: No new type errors from sponsors.ts or levels.ts changes (existing errors may be present from other files — focus on no NEW errors)

- [ ] **Step 6.2.3: Commit**

```bash
git add apps/web/lib/sponsors.ts apps/web/lib/levels.ts
git commit -m "feat: update sponsor types + level descriptions for new 6-tier model"
```

---

## Task 7: Frontend — Sponsor Selection Page (Marketplace Rewrite)

**Files:**
- Rewrite: `apps/web/app/(game)/league/[leagueId]/budget/marketplace/page.tsx`
- Rewrite: `apps/web/app/(game)/league/[leagueId]/budget/marketplace/marketplace-client.tsx`

### Step 7.1: Rewrite marketplace server component

- [ ] **Step 7.1.1: Simplify page.tsx — no more eligibility checks**

Replace the entire content of `apps/web/app/(game)/league/[leagueId]/budget/marketplace/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MarketplaceClient } from "./marketplace-client";
import type { SponsorRow, TeamSponsor } from "@/lib/sponsors";

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function MarketplacePage({ params }: Props) {
  const { leagueId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get team for this league
  const { data: team } = await supabase
    .from("teams")
    .select("id, level")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!team) redirect(`/league/${leagueId}`);

  // Get all sponsors (sorted by sort_order)
  const { data: sponsors } = await supabase
    .from("sponsors")
    .select("*")
    .order("sort_order");

  // Get current team sponsor (if any)
  const { data: teamSponsor } = await supabase
    .from("team_sponsors")
    .select("*, sponsors(*)")
    .eq("team_id", team.id)
    .maybeSingle();

  return (
    <MarketplaceClient
      leagueId={leagueId}
      teamId={team.id}
      teamLevel={team.level}
      sponsors={(sponsors ?? []) as SponsorRow[]}
      currentSponsor={teamSponsor as TeamSponsor | null}
    />
  );
}
```

### Step 7.2: Rewrite marketplace client component

- [ ] **Step 7.2.1: Create new single-sponsor picker UI**

Replace the entire content of `apps/web/app/(game)/league/[leagueId]/budget/marketplace/marketplace-client.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SponsorRow, TeamSponsor } from "@/lib/sponsors";
import { formatBudget, thresholdLabel, expandNationality } from "@/lib/sponsors";
import { saveSponsor } from "../actions";

interface Props {
  leagueId: string;
  teamId: string;
  teamLevel: number;
  sponsors: SponsorRow[];
  currentSponsor: TeamSponsor | null;
}

export function MarketplaceClient({
  leagueId,
  teamId,
  teamLevel,
  sponsors,
  currentSponsor,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(
    currentSponsor?.sponsor_id ?? null
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const hasChanged = selectedId !== (currentSponsor?.sponsor_id ?? null);

  // Group sponsors by tier
  const tiers = Array.from(new Set(sponsors.map((s) => s.tier))).sort();

  function handleSelect(sponsor: SponsorRow) {
    if (sponsor.unlock_level > teamLevel) return;
    setSelectedId(sponsor.id);
  }

  function handleSave() {
    if (!selectedId || !hasChanged) return;
    startTransition(async () => {
      const result = await saveSponsor({ teamId, sponsorId: selectedId });
      if (result.success) {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div>
        <h2 className="text-[length:var(--type-title)] font-semibold text-[var(--text-high)]">
          Choose your Sponsor
        </h2>
        <p className="text-[length:var(--type-body)] text-[var(--text-mid)] mt-1">
          One sponsor per team. Change takes effect tomorrow.
        </p>
      </div>

      {tiers.map((tier) => (
        <div key={tier} className="flex flex-col gap-3">
          <h3 className="text-[length:var(--type-section)] font-semibold text-[var(--text-mid)]">
            Tier {tier}
          </h3>

          {sponsors
            .filter((s) => s.tier === tier)
            .map((sponsor) => {
              const locked = sponsor.unlock_level > teamLevel;
              const isSelected = selectedId === sponsor.id;
              const isCurrent = currentSponsor?.sponsor_id === sponsor.id;
              const isExpanded = expandedId === sponsor.id;

              return (
                <button
                  key={sponsor.id}
                  onClick={() => {
                    if (!locked) handleSelect(sponsor);
                    setExpandedId(isExpanded ? null : sponsor.id);
                  }}
                  className={cn(
                    "w-full text-left rounded-[var(--radius-md)] border p-4 transition-colors",
                    locked && "opacity-40 cursor-not-allowed",
                    isSelected && !locked
                      ? "border-[var(--accent-default)] bg-[var(--bg-surface-active)]"
                      : "border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {locked ? (
                        <Lock className="w-4 h-4 text-[var(--text-low)]" />
                      ) : isSelected ? (
                        <Check className="w-4 h-4 text-[var(--accent-default)]" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-[var(--border-default)]" />
                      )}
                      <div>
                        <span className="text-[length:var(--type-body)] font-semibold text-[var(--text-high)]">
                          {sponsor.name}
                        </span>
                        {isCurrent && (
                          <Badge variant="outline" className="ml-2 text-[length:var(--type-small)]">
                            Current
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[length:var(--type-body)] text-[var(--accent-default)]">
                        {formatBudget(sponsor.monthly_budget)}/mo
                      </span>
                      {locked && (
                        <Badge variant="secondary" className="text-[length:var(--type-small)]">
                          Lv.{sponsor.unlock_level}
                        </Badge>
                      )}
                      <ChevronRight
                        className={cn(
                          "w-4 h-4 text-[var(--text-low)] transition-transform",
                          isExpanded && "rotate-90",
                        )}
                      />
                    </div>
                  </div>

                  {/* Bonus details (expanded) */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                      <BonusTable sponsor={sponsor} />
                    </div>
                  )}
                </button>
              );
            })}
        </div>
      ))}

      {/* Sticky save bar */}
      {hasChanged && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-[var(--bg-app)] border-t border-[var(--border-default)] z-30">
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? "Saving..." : "Confirm Sponsor Change"}
          </Button>
        </div>
      )}
    </div>
  );
}

function BonusTable({ sponsor }: { sponsor: SponsorRow }) {
  const natCodes = expandNationality(sponsor.nationality);
  const hasNat = natCodes.length > 0;

  if (sponsor.has_explicit_prestige) {
    // T5-T6: 5 lines with explicit prestige amounts
    return (
      <div className="flex flex-col gap-1.5 text-[length:var(--type-caption)]">
        <BonusLine label="One-Day" threshold={sponsor.one_day_threshold} bonus={sponsor.bonus_one_day} />
        <BonusLine label="Monument" threshold={sponsor.monument_threshold!} bonus={sponsor.bonus_monument!} />
        <BonusLine label="Stage Race GC" threshold={sponsor.gc_threshold} bonus={sponsor.bonus_gc} />
        <BonusLine label="Grand Tour GC" threshold={sponsor.grand_tour_threshold!} bonus={sponsor.bonus_grand_tour!} />
        <BonusLine label="Stage" threshold={sponsor.stage_threshold} bonus={sponsor.bonus_stage} suffix="(×2 GT)" />
      </div>
    );
  }

  // T1-T4: 3 lines with multiplier footnote
  return (
    <div className="flex flex-col gap-1.5 text-[length:var(--type-caption)]">
      <BonusLine label="GC" threshold={sponsor.gc_threshold} bonus={sponsor.bonus_gc} />
      <BonusLine label="One-Day" threshold={sponsor.one_day_threshold} bonus={sponsor.bonus_one_day} />
      <BonusLine label="Stage" threshold={sponsor.stage_threshold} bonus={sponsor.bonus_stage} />
      <p className="text-[var(--text-low)] mt-1">
        ×2 Monument / Grand Tour
        {hasNat && <> · ×1.5 {natCodes.map((c) => countryFlag(c)).join("/")}</>}
      </p>
    </div>
  );
}

function BonusLine({
  label,
  threshold,
  bonus,
  suffix,
}: {
  label: string;
  threshold: number;
  bonus: number;
  suffix?: string;
}) {
  return (
    <div className="flex justify-between text-[var(--text-mid)]">
      <span>
        {label} — {thresholdLabel(threshold)}
      </span>
      <span className="font-mono text-[var(--text-high)]">
        {(bonus / 1000).toFixed(0)}K
        {suffix && <span className="text-[var(--text-low)] ml-1">{suffix}</span>}
      </span>
    </div>
  );
}

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}
```

- [ ] **Step 7.2.2: Run typecheck**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm typecheck`
Expected: No new type errors (may fail on actions.ts import — that's expected, we fix it in Task 8)

- [ ] **Step 7.2.3: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/budget/marketplace/page.tsx apps/web/app/\(game\)/league/\[leagueId\]/budget/marketplace/marketplace-client.tsx
git commit -m "feat: rewrite marketplace — single-sponsor picker with bonus tables"
```

---

## Task 8: Frontend — Save Sponsor Action (Simplified)

**Files:**
- Rewrite: `apps/web/app/(game)/league/[leagueId]/budget/actions.ts`

### Step 8.1: Rewrite saveSponsor action

- [ ] **Step 8.1.1: Replace saveSponsors with simplified saveSponsor**

Replace the entire content of `apps/web/app/(game)/league/[leagueId]/budget/actions.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const SaveSponsorSchema = z.object({
  teamId: z.uuid(),
  sponsorId: z.uuid(),
});

/**
 * Save sponsor selection — one sponsor per team, immediate effect (next day).
 *
 * Validates:
 *   1. Team belongs to current user
 *   2. Sponsor unlock_level ≤ team.level
 *
 * Upserts team_sponsors row (unique on team_id).
 */
export async function saveSponsor(input: { teamId: string; sponsorId: string }) {
  const parsed = SaveSponsorSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input" };
  }

  const { teamId, sponsorId } = parsed.data;
  const supabase = await createClient();

  // Verify team ownership
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: team } = await supabase
    .from("teams")
    .select("id, level, league_id")
    .eq("id", teamId)
    .eq("user_id", user.id)
    .single();

  if (!team) return { success: false, error: "Team not found" };

  // Verify sponsor exists and is unlocked
  const { data: sponsor } = await supabase
    .from("sponsors")
    .select("id, name, unlock_level")
    .eq("id", sponsorId)
    .single();

  if (!sponsor) return { success: false, error: "Sponsor not found" };
  if (sponsor.unlock_level > team.level) {
    return { success: false, error: `Requires level ${sponsor.unlock_level}` };
  }

  // Upsert team_sponsors (one per team — conflict on team_id unique)
  const { error } = await supabase.from("team_sponsors").upsert(
    {
      team_id: teamId,
      sponsor_id: sponsorId,
      activated_at: new Date().toISOString(),
    },
    { onConflict: "team_id" }
  );

  if (error) return { success: false, error: error.message };

  revalidatePath(`/league/${team.league_id}`);
  return { success: true, sponsorName: sponsor.name };
}
```

- [ ] **Step 8.1.2: Run typecheck**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm typecheck`
Expected: No new type errors

- [ ] **Step 8.1.3: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/budget/actions.ts
git commit -m "feat: simplified saveSponsor action — single sponsor, upsert on team_id"
```

---

## Task 9: Frontend — Budget Page (Phase Income Display)

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/budget/page.tsx`

### Step 9.1: Update budget page for phase finance

- [ ] **Step 9.1.1: Read current budget page**

Read the full file to understand current structure before modifying.

- [ ] **Step 9.1.2: Update sponsor income display**

Key changes to make in the budget page:

1. **Remove `first_phase_budget` / `payments_count` logic** — no more escalating sponsors
2. **Remove `pending_sponsor_id` / `effective_phase_id` display** — no more pending changes
3. **Show phase-based income** (no /30 division):
   - Show sponsor base per phase: `sponsor.monthly_budget` (e.g. "250K / phase")
   - Show salary total per phase: `sum(contracts.locked_salary)` 
   - Show net per phase: `phase_income - phase_salaries`
4. **Remove synthetic sponsor payment entries** — the phase finance job handles actual logging
5. **Update the sponsor section** to show current sponsor name + link to marketplace

The exact code changes depend on the current structure of the file — the implementing agent should read the file first and adapt. The key principle: show full monthly_budget amounts per phase (no division), remove all pending/escalation state, simplify to single sponsor display.

- [ ] **Step 9.1.3: Run typecheck + dev server check**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm typecheck`
Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm build` (verify no build errors)

- [ ] **Step 9.1.4: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/budget/page.tsx
git commit -m "feat: budget page — phase income display, remove pending/escalation state"
```

---

## Task 10: Cleanup and Verification

**Files:**
- Various: remove dead code, verify build

### Step 10.1: Remove dead code

- [ ] **Step 10.1.1: Check for remaining references to old sponsor model**

Search the codebase for these patterns and remove/update references:
- `first_phase_budget` — should no longer exist in any TS or Python code
- `payments_count` — should no longer exist
- `pending_sponsor_id` — should no longer exist
- `effective_phase_id` — should no longer exist
- `slot.*secondary\|principal` — should no longer exist (sponsor slots removed)
- `CONVERSION_RATE` — should no longer exist in Python code
- `calculate_rider_bonus` — should no longer exist
- `rider_revenue` — treasury_log type still allowed in constraint for historical data, but should not be referenced in new code
- `nationality_condition` / `specialty_condition` / `result_condition` — should no longer exist

For each reference found: remove it or update it to use the new model.

- [ ] **Step 10.1.2: Verify monthly_finance.py is no longer imported directly**

Check that `run_pipeline.py` and `main.py` no longer import from `monthly_finance`. The file can remain for reference but should not be called.

### Step 10.2: Full build verification

- [ ] **Step 10.2.1: Run all Python tests**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && python3 -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 10.2.2: Run all web tests**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm test`
Expected: All tests PASS (or only pre-existing failures)

- [ ] **Step 10.2.3: Run typecheck**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm typecheck`
Expected: No new type errors

- [ ] **Step 10.2.4: Run build**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm build`
Expected: Build succeeds

- [ ] **Step 10.2.5: Final commit**

```bash
git add -A
git commit -m "chore: cleanup dead sponsor code + verify build"
```

---

## Post-Implementation Notes

### Migration Application
The migration `20260402300000_sponsors_rework.sql` needs to be applied to the remote Supabase instance:
```bash
supabase db push
```

### Pipeline Commands After Migration
```bash
cd services/pcs-sync

# Run daily finance (replaces monthly-finance)
python3 run_pipeline.py phase-finance

# Post-race now also calculates sponsor bonuses
python3 run_pipeline.py post-race --race "race/paris-nice/2026/stage-3"
```

### What's NOT Covered (Out of Scope)
Per the design spec, these are separate future tasks:
- Policy rework (cooldown system)
- Release rider simplification
- Auction phase decoupling
- Bankruptcy adaptation refinements
- Cron job for phase-finance automation
