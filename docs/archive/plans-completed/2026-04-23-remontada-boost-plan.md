# Remontada Boost — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Mechanism 1 of the Anti-Runaway System — a 2x point multiplier triggered when a hors-podium player overtakes another player during a Grand Tour. Target deadline: before Giro 2026 starts on 2026-05-08.

**Architecture:** Boost tracking lives in two new Supabase tables. Overtake detection runs inside the existing Python scoring pipeline (`services/pcs-sync/scoring.py`) after each race is ingested — it takes a ranking snapshot before/after scoring, diffs them, and inserts triggers + upserts active boosts for eligible overtakes. The scoring formula at `scoring.py:365` gets a `remontada_mult` factor (1.0 or 2.0) looked up per team+stage before xp is written. The Next.js UI fetches active boosts via server component and renders a banner on the Team > GT sub-tab.

**Tech Stack:**
- Python 3.9+ (`services/pcs-sync`) — scoring + overtake detection
- Supabase (Postgres) — new tables via SQL migration
- Next.js 16 App Router + TypeScript — banner UI (server-side data fetch)
- pytest for Python tests, vitest for TS if needed

---

## Prerequisites

- Design spec reviewed: `docs/plans/2026-04-23-anti-runaway-system-design.md`
- Local Supabase CLI linked (`supabase` command works, `SUPABASE_ACCESS_TOKEN` exported)
- Python env set up in `services/pcs-sync/` with `.env` (per CLAUDE.md)
- `apps/web/.env.local` contains valid Supabase keys
- No conflicts expected with other Anti-Runaway mechanics (Co-Unlock and Level Curve Stretch are separate plans)

## File Structure

**New files (7):**
- `supabase/migrations/20260423120000_remontada_boost.sql` — tables + indexes
- `services/pcs-sync/remontada.py` — helpers: GT/stage parsing, snapshot, detection, boost CRUD
- `services/pcs-sync/tests/test_remontada.py` — unit tests for helpers
- `services/pcs-sync/tests/test_remontada_integration.py` — integration test end-to-end
- `apps/web/lib/remontada.ts` — types + `getActiveRemontadaBoost(teamId)` server-side fetch
- `apps/web/components/remontada-boost-banner.tsx` — banner UI component
- `apps/web/app/(game)/league/[leagueId]/team/gt/_remontada-banner-slot.tsx` — server component wrapper

**Modified files (2):**
- `services/pcs-sync/scoring.py` — add remontada multiplier at line 365, add pre/post snapshot + trigger pass around line 420
- `apps/web/app/(game)/league/[leagueId]/team/gt/page.tsx` — render the banner slot at top

## Conventions

- **Python tests** run from `services/pcs-sync/` with `pytest -v`
- **TS tests** run from `apps/web/` with `pnpm test`
- **Migration** applied with `supabase db push`
- All commits include the Claude Co-Authored-By line per CLAUDE.md
- GT race slug pattern: `race/{giro-d-italia|tour-de-france|vuelta-a-espana}/{year}/{stage-N|gc}`
- Stage numbers parsed from `/stage-N` suffix; `/gc` slugs excluded from stage counting

---

## Task 1: Create the Supabase migration for Remontada tables

**Files:**
- Create: `supabase/migrations/20260423120000_remontada_boost.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
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
```

- [ ] **Step 2: Apply the migration locally**

Run: `supabase db push`
Expected: "Applied migration 20260423120000_remontada_boost.sql"

- [ ] **Step 3: Verify tables exist**

Run: `supabase db remote commit --db-url "$SUPABASE_DB_URL" --debug 2>&1 | head -5` or via SQL:
```bash
psql "$SUPABASE_DB_URL" -c "\dt remontada_*"
```
Expected: two rows, `remontada_boost_triggers` and `remontada_boosts`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260423120000_remontada_boost.sql
git commit -m "feat(db): remontada boost tables + anti-ping-pong unique constraint"
```

---

## Task 2: Add Python helpers for GT/stage parsing

**Files:**
- Create: `services/pcs-sync/remontada.py`
- Create: `services/pcs-sync/tests/test_remontada.py`

- [ ] **Step 1: Write failing tests**

```python
# services/pcs-sync/tests/test_remontada.py
from remontada import get_gt_identifier, get_stage_number

def test_gt_identifier_giro():
    assert get_gt_identifier("race/giro-d-italia/2026/stage-5") == "giro-d-italia"

def test_gt_identifier_tour():
    assert get_gt_identifier("race/tour-de-france/2026/stage-1") == "tour-de-france"

def test_gt_identifier_vuelta():
    assert get_gt_identifier("race/vuelta-a-espana/2026/gc") == "vuelta-a-espana"

def test_gt_identifier_non_gt_returns_none():
    assert get_gt_identifier("race/paris-nice/2026/stage-3") is None

def test_gt_identifier_empty_returns_none():
    assert get_gt_identifier("") is None

def test_stage_number_simple():
    assert get_stage_number("race/giro-d-italia/2026/stage-5") == 5

def test_stage_number_double_digit():
    assert get_stage_number("race/tour-de-france/2026/stage-21") == 21

def test_stage_number_gc_slug_returns_none():
    assert get_stage_number("race/vuelta-a-espana/2026/gc") is None

def test_stage_number_unrecognized_returns_none():
    assert get_stage_number("race/giro-d-italia/2026/prologue") is None
```

- [ ] **Step 2: Run to verify tests fail**

Run: `cd services/pcs-sync && pytest tests/test_remontada.py -v`
Expected: `ModuleNotFoundError: No module named 'remontada'`.

- [ ] **Step 3: Implement helpers**

```python
# services/pcs-sync/remontada.py
"""Anti-Runaway Mechanism 1: Remontada Boost helpers.

See docs/plans/2026-04-23-anti-runaway-system-design.md §3."""
from __future__ import annotations
import re
from typing import Optional

GT_SLUGS = ("giro-d-italia", "tour-de-france", "vuelta-a-espana")

_GT_PATTERN = re.compile(r"^race/(giro-d-italia|tour-de-france|vuelta-a-espana)/")
_STAGE_PATTERN = re.compile(r"/stage-(\d+)(?:/|$)")

def get_gt_identifier(race_slug: str) -> Optional[str]:
    """Return 'giro-d-italia' | 'tour-de-france' | 'vuelta-a-espana' or None."""
    if not race_slug:
        return None
    m = _GT_PATTERN.match(race_slug)
    return m.group(1) if m else None

def get_stage_number(race_slug: str) -> Optional[int]:
    """Return the integer stage number from a slug like '.../stage-5'. None for /gc or prologues."""
    if not race_slug:
        return None
    m = _STAGE_PATTERN.search(race_slug)
    return int(m.group(1)) if m else None
```

- [ ] **Step 4: Run to verify tests pass**

Run: `cd services/pcs-sync && pytest tests/test_remontada.py -v`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/remontada.py services/pcs-sync/tests/test_remontada.py
git commit -m "feat(remontada): GT identifier + stage number parsing"
```

---

## Task 3: Add Python helper for league ranking snapshot

**Files:**
- Modify: `services/pcs-sync/remontada.py`
- Modify: `services/pcs-sync/tests/test_remontada.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/test_remontada.py`:

```python
from unittest.mock import MagicMock
from remontada import snapshot_league_ranking

def _mock_teams_resp(teams):
    client = MagicMock()
    resp = MagicMock()
    resp.data = teams
    (client.table.return_value
        .select.return_value
        .eq.return_value
        .order.return_value
        .execute.return_value) = resp
    return client

def test_snapshot_orders_by_xp_desc():
    client = _mock_teams_resp([
        {"id": "t1", "cumulative_xp": 500},
        {"id": "t2", "cumulative_xp": 780},
        {"id": "t3", "cumulative_xp": 225},
    ])
    # Supabase mock returns the list as-is; helper sorts defensively.
    snap = snapshot_league_ranking(client, "league-uuid")
    assert snap == [("t2", 1), ("t1", 2), ("t3", 3)]

def test_snapshot_empty_league():
    client = _mock_teams_resp([])
    snap = snapshot_league_ranking(client, "league-uuid")
    assert snap == []
```

- [ ] **Step 2: Run to verify tests fail**

Run: `cd services/pcs-sync && pytest tests/test_remontada.py::test_snapshot_orders_by_xp_desc -v`
Expected: `ImportError: cannot import name 'snapshot_league_ranking' from 'remontada'`.

- [ ] **Step 3: Implement helper**

Append to `remontada.py`:

```python
from supabase import Client

def snapshot_league_ranking(
    supabase: Client,
    league_id: str,
) -> list[tuple[str, int]]:
    """Return [(team_id, rank), ...] sorted by cumulative_xp desc, rank starting at 1."""
    resp = (
        supabase.table("teams")
        .select("id, cumulative_xp")
        .eq("league_id", league_id)
        .order("cumulative_xp", desc=True)
        .execute()
    )
    rows = resp.data or []
    # Defensive re-sort: treat None as 0.
    rows.sort(key=lambda r: -(r.get("cumulative_xp") or 0))
    return [(row["id"], rank) for rank, row in enumerate(rows, start=1)]
```

- [ ] **Step 4: Run to verify tests pass**

Run: `cd services/pcs-sync && pytest tests/test_remontada.py -v`
Expected: 11 passed.

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/remontada.py services/pcs-sync/tests/test_remontada.py
git commit -m "feat(remontada): league ranking snapshot helper"
```

---

## Task 4: Add overtake detection helper

**Files:**
- Modify: `services/pcs-sync/remontada.py`
- Modify: `services/pcs-sync/tests/test_remontada.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/test_remontada.py`:

```python
from remontada import detect_overtakes

def test_detect_no_overtakes_when_unchanged():
    before = [("a", 1), ("b", 2), ("c", 3)]
    after = [("a", 1), ("b", 2), ("c", 3)]
    assert detect_overtakes(before, after) == []

def test_detect_simple_overtake_hors_podium():
    # b was 2nd, c was 3rd. c moved to 2nd, b to 3rd. c is overtaker of b.
    # But c ends up at rank 2 — IN podium — so not eligible (overtaker must END hors-podium).
    # Eligibility rule: overtaker's NEW rank must be >= 4.
    before = [("a", 1), ("b", 2), ("c", 3)]
    after = [("a", 1), ("c", 2), ("b", 3)]
    assert detect_overtakes(before, after) == []

def test_detect_overtake_behind_podium():
    # 4-team league: team d (rank 4) overtakes team c (rank 3).
    # d ends up at rank 3 — IN podium — so not eligible.
    before = [("a", 1), ("b", 2), ("c", 3), ("d", 4)]
    after = [("a", 1), ("b", 2), ("d", 3), ("c", 4)]
    assert detect_overtakes(before, after) == []

def test_detect_overtake_deep_field():
    # 5-team league: team e (rank 5) overtakes team d (rank 4). e ends at rank 4 — still hors-podium.
    before = [("a", 1), ("b", 2), ("c", 3), ("d", 4), ("e", 5)]
    after = [("a", 1), ("b", 2), ("c", 3), ("e", 4), ("d", 5)]
    assert detect_overtakes(before, after) == [("e", "d")]

def test_detect_overtake_multi_leap():
    # team e (rank 5) leaps past d (rank 4) AND c (rank 3) in one scoring event, ending at rank 3.
    # e ends at podium — not eligible.
    before = [("a", 1), ("b", 2), ("c", 3), ("d", 4), ("e", 5)]
    after = [("a", 1), ("b", 2), ("e", 3), ("c", 4), ("d", 5)]
    assert detect_overtakes(before, after) == []

def test_detect_overtake_multi_leap_staying_hors_podium():
    # 6-team league: team f (rank 6) leaps past e (rank 5) AND d (rank 4), ending at rank 4.
    # f ends at rank 4 — hors-podium — eligible. Both (f, e) and (f, d) are triggers.
    before = [("a", 1), ("b", 2), ("c", 3), ("d", 4), ("e", 5), ("f", 6)]
    after = [("a", 1), ("b", 2), ("c", 3), ("f", 4), ("d", 5), ("e", 6)]
    # f passed both d and e; both pairs recorded.
    assert sorted(detect_overtakes(before, after)) == [("f", "d"), ("f", "e")]

def test_detect_small_league_under_four_players():
    # Rule: mechanic inactive when league has <4 players (no hors-podium possible).
    before = [("a", 1), ("b", 2), ("c", 3)]
    after = [("a", 1), ("c", 2), ("b", 3)]
    assert detect_overtakes(before, after) == []
```

- [ ] **Step 2: Run to verify tests fail**

Run: `cd services/pcs-sync && pytest tests/test_remontada.py::test_detect_overtake_deep_field -v`
Expected: `ImportError: cannot import name 'detect_overtakes'`.

- [ ] **Step 3: Implement helper**

Append to `remontada.py`:

```python
def detect_overtakes(
    before: list[tuple[str, int]],
    after: list[tuple[str, int]],
) -> list[tuple[str, str]]:
    """Return [(overtaker_team_id, overtaken_team_id), ...] for each eligible overtake.

    Eligibility (per spec §3.2):
      - League must have >= 4 teams (non-podium slot must exist).
      - Overtaker's new rank must be >= 4 (ended hors-podium).
      - Overtaken team must have ended BELOW the overtaker in 'after' AND been ABOVE in 'before'.
    """
    if len(after) < 4:
        return []

    before_rank = {team_id: rank for team_id, rank in before}
    after_rank = {team_id: rank for team_id, rank in after}

    overtakes: list[tuple[str, str]] = []
    for team_id, new_rank in after_rank.items():
        if new_rank < 4:
            continue  # overtaker must end hors-podium
        old_rank = before_rank.get(team_id)
        if old_rank is None or old_rank <= new_rank:
            continue  # team didn't move up
        # Every team that was above us before AND is below us now = a pair overtaken.
        for other_id, other_new_rank in after_rank.items():
            if other_id == team_id:
                continue
            other_old_rank = before_rank.get(other_id)
            if other_old_rank is None:
                continue
            if other_old_rank < old_rank and other_new_rank > new_rank:
                overtakes.append((team_id, other_id))
    return overtakes
```

- [ ] **Step 4: Run to verify tests pass**

Run: `cd services/pcs-sync && pytest tests/test_remontada.py -v`
Expected: 18 passed.

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/remontada.py services/pcs-sync/tests/test_remontada.py
git commit -m "feat(remontada): overtake detection with hors-podium + 4-team guards"
```

---

## Task 5: Add trigger + boost CRUD helpers

**Files:**
- Modify: `services/pcs-sync/remontada.py`
- Modify: `services/pcs-sync/tests/test_remontada.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/test_remontada.py`:

```python
from remontada import record_overtake

def _mock_upsert_client():
    client = MagicMock()
    # trigger insert returns a mock "inserted" response by default
    client.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{}])
    client.table.return_value.upsert.return_value.execute.return_value = MagicMock(data=[{}])
    return client

def test_record_overtake_inserts_trigger_and_upserts_boost():
    client = _mock_upsert_client()
    record_overtake(
        client,
        league_id="league-1",
        gt_identifier="giro-d-italia",
        overtaker_team_id="team-a",
        overtaken_team_id="team-b",
        triggered_at_stage=3,
    )
    # Assert: one insert on triggers, one upsert on boosts.
    insert_call = client.table.call_args_list[0]
    assert insert_call.args == ("remontada_boost_triggers",)
    upsert_call = client.table.call_args_list[2]  # 0=triggers insert, 1=triggers insert chain, 2=boosts upsert
    # Simpler assertion: at least one call was on remontada_boosts.
    table_names = [c.args[0] for c in client.table.call_args_list]
    assert "remontada_boost_triggers" in table_names
    assert "remontada_boosts" in table_names

def test_record_overtake_skips_when_trigger_exists():
    # Supabase insert into triggers with unique constraint raises on conflict.
    # Our helper catches 23505 (unique_violation) and returns False without touching boosts.
    client = MagicMock()
    from postgrest.exceptions import APIError

    # APIError needs a dict-shaped message; simulate unique violation.
    err = APIError({"code": "23505", "message": "duplicate key"})
    client.table.return_value.insert.return_value.execute.side_effect = err

    applied = record_overtake(
        client,
        league_id="league-1",
        gt_identifier="giro-d-italia",
        overtaker_team_id="team-a",
        overtaken_team_id="team-b",
        triggered_at_stage=3,
    )
    assert applied is False
    # Boost upsert should NOT have been called.
    table_names = [c.args[0] for c in client.table.call_args_list]
    assert "remontada_boosts" not in table_names
```

- [ ] **Step 2: Run to verify tests fail**

Run: `cd services/pcs-sync && pytest tests/test_remontada.py::test_record_overtake_inserts_trigger_and_upserts_boost -v`
Expected: `ImportError: cannot import name 'record_overtake'`.

- [ ] **Step 3: Implement helper**

Append to `remontada.py`:

```python
from postgrest.exceptions import APIError

BOOST_WINDOW_STAGES = 3
DEFAULT_MULTIPLIER = 2.0

def record_overtake(
    supabase: Client,
    *,
    league_id: str,
    gt_identifier: str,
    overtaker_team_id: str,
    overtaken_team_id: str,
    triggered_at_stage: int,
) -> bool:
    """Insert an anti-ping-pong trigger and upsert the active boost.

    Returns True if the overtake was NEW (trigger inserted + boost applied),
    False if the trigger already existed (ping-pong prevented — no boost change).

    Reset cumul: upsert on (team_id, gt_identifier) replaces expires_after_stage with
    triggered_at_stage + BOOST_WINDOW_STAGES, keeping multiplier at DEFAULT_MULTIPLIER.
    """
    # 1) Try to insert the trigger (unique key enforces 1 per pair per GT).
    try:
        supabase.table("remontada_boost_triggers").insert({
            "league_id": league_id,
            "gt_identifier": gt_identifier,
            "overtaker_team_id": overtaker_team_id,
            "overtaken_team_id": overtaken_team_id,
            "triggered_at_stage": triggered_at_stage,
        }).execute()
    except APIError as e:
        # unique_violation on primary key → pair already triggered this GT.
        if getattr(e, "code", None) == "23505" or "23505" in str(e):
            return False
        raise

    # 2) Upsert the boost (Reset behavior: refresh expires_after_stage).
    supabase.table("remontada_boosts").upsert({
        "league_id": league_id,
        "team_id": overtaker_team_id,
        "gt_identifier": gt_identifier,
        "triggered_at_stage": triggered_at_stage,
        "expires_after_stage": triggered_at_stage + BOOST_WINDOW_STAGES,
        "multiplier": DEFAULT_MULTIPLIER,
        "overtaken_team_id": overtaken_team_id,
        "updated_at": "now()",
    }, on_conflict="team_id,gt_identifier").execute()

    return True
```

- [ ] **Step 4: Run to verify tests pass**

Run: `cd services/pcs-sync && pytest tests/test_remontada.py -v`
Expected: 20 passed.

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/remontada.py services/pcs-sync/tests/test_remontada.py
git commit -m "feat(remontada): record_overtake with anti-ping-pong and Reset cumul"
```

---

## Task 6: Add active-boost lookup used during scoring

**Files:**
- Modify: `services/pcs-sync/remontada.py`
- Modify: `services/pcs-sync/tests/test_remontada.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/test_remontada.py`:

```python
from remontada import get_active_multiplier

def _mock_boost_lookup(boost_row):
    client = MagicMock()
    resp = MagicMock()
    resp.data = boost_row  # dict or None
    (client.table.return_value
        .select.return_value
        .eq.return_value
        .eq.return_value
        .maybe_single.return_value
        .execute.return_value) = resp
    return client

def test_multiplier_returns_default_when_no_boost():
    client = _mock_boost_lookup(None)
    mult = get_active_multiplier(client, team_id="t-1", gt_identifier="giro-d-italia", stage_number=5)
    assert mult == 1.0

def test_multiplier_returns_2x_when_stage_within_window():
    # triggered at stage 3, expires after stage 6 → active for stages 4, 5, 6.
    client = _mock_boost_lookup({
        "triggered_at_stage": 3,
        "expires_after_stage": 6,
        "multiplier": 2.0,
    })
    assert get_active_multiplier(client, team_id="t-1", gt_identifier="giro-d-italia", stage_number=5) == 2.0

def test_multiplier_returns_default_when_stage_before_trigger():
    # Boost triggered at stage 5; we're scoring stage 4 (earlier). Should be 1.0.
    client = _mock_boost_lookup({
        "triggered_at_stage": 5,
        "expires_after_stage": 8,
        "multiplier": 2.0,
    })
    assert get_active_multiplier(client, team_id="t-1", gt_identifier="giro-d-italia", stage_number=4) == 1.0

def test_multiplier_returns_default_when_stage_after_expiry():
    client = _mock_boost_lookup({
        "triggered_at_stage": 3,
        "expires_after_stage": 6,
        "multiplier": 2.0,
    })
    assert get_active_multiplier(client, team_id="t-1", gt_identifier="giro-d-italia", stage_number=7) == 1.0

def test_multiplier_boundary_on_trigger_stage_is_default():
    # Spec: boost applies to the NEXT 3 stages after trigger, not the trigger stage itself.
    client = _mock_boost_lookup({
        "triggered_at_stage": 3,
        "expires_after_stage": 6,
        "multiplier": 2.0,
    })
    assert get_active_multiplier(client, team_id="t-1", gt_identifier="giro-d-italia", stage_number=3) == 1.0
```

- [ ] **Step 2: Run to verify tests fail**

Run: `cd services/pcs-sync && pytest tests/test_remontada.py::test_multiplier_returns_default_when_no_boost -v`
Expected: `ImportError: cannot import name 'get_active_multiplier'`.

- [ ] **Step 3: Implement helper**

Append to `remontada.py`:

```python
def get_active_multiplier(
    supabase: Client,
    *,
    team_id: str,
    gt_identifier: str,
    stage_number: int,
) -> float:
    """Return the boost multiplier active for this team at this GT stage, else 1.0.

    Window semantics: a boost triggered at stage T covers stages T+1..T+BOOST_WINDOW_STAGES
    (i.e., expires_after_stage inclusive). The trigger stage itself (T) is NOT boosted.
    """
    resp = (
        supabase.table("remontada_boosts")
        .select("triggered_at_stage, expires_after_stage, multiplier")
        .eq("team_id", team_id)
        .eq("gt_identifier", gt_identifier)
        .maybe_single()
        .execute()
    )
    row = resp.data
    if not row:
        return 1.0
    if stage_number <= row["triggered_at_stage"]:
        return 1.0
    if stage_number > row["expires_after_stage"]:
        return 1.0
    return float(row["multiplier"])
```

- [ ] **Step 4: Run to verify tests pass**

Run: `cd services/pcs-sync && pytest tests/test_remontada.py -v`
Expected: 25 passed.

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/remontada.py services/pcs-sync/tests/test_remontada.py
git commit -m "feat(remontada): get_active_multiplier with trigger-stage boundary guard"
```

---

## Task 7: Wire multiplier into scoring.py

**Files:**
- Modify: `services/pcs-sync/scoring.py:365`
- Test: extends `services/pcs-sync/tests/test_scoring_gt.py` (existing file)

- [ ] **Step 1: Patch scoring.py to look up the multiplier and apply it**

Modify `services/pcs-sync/scoring.py`:

At the top, add import:
```python
from remontada import get_gt_identifier, get_stage_number, get_active_multiplier
```

Replace the block around line 354–365 (the `if _is_gt_slug(race_slug) and ...` block through the `xp = ...` assignment):

```python
                # GT role multiplier + daily classif bonus — only for GT squad members.
                role_mult = 1.0
                classif_pts = 0.0
                gt_id = get_gt_identifier(race_slug)
                stage_no = get_stage_number(race_slug)
                if _is_gt_slug(race_slug) and (team_id, rider_id) in gt_squad_members:
                    role = gt_roles.get((team_id, rider_id), "domestique")
                    role_mult = _role_multiplier(role, race_slug, entry.get("is_itt", False))
                    classif_pts = _classif_bonus(
                        classif_by_key.get((race_slug, rider_id), []),
                        role,
                    )

                # Remontada Boost (Mech 1): 2x when active for this team at this GT stage.
                remontada_mult = 1.0
                if gt_id and stage_no is not None:
                    remontada_mult = get_active_multiplier(
                        supabase,
                        team_id=team_id,
                        gt_identifier=gt_id,
                        stage_number=stage_no,
                    )

                xp = (raw_points * role_mult * (1 + bonus) + classif_pts) * remontada_mult
```

Also add `remontada_mult` to the `rider_xp_daily` upsert so it's auditable:

```python
                    supabase.table("rider_xp_daily").upsert({
                        "team_id": team_id,
                        "rider_id": rider_id,
                        "contract_id": contract["id"],
                        "date": entry.get("race_date", today),
                        "raw_pcs_points": raw_points,
                        "strategy_bonus": bonus,
                        "remontada_mult": remontada_mult,
                        "xp_gained": round(xp, 2),
                        "race_slug": race_slug,
                    }, on_conflict="team_id,rider_id,race_slug").execute()
```

- [ ] **Step 2: Add `remontada_mult` column to rider_xp_daily**

Extend `supabase/migrations/20260423120000_remontada_boost.sql` (edit the existing migration file):

At the bottom, add:
```sql
alter table rider_xp_daily
  add column if not exists remontada_mult numeric(3,1) not null default 1.0;

comment on column rider_xp_daily.remontada_mult is
  'Remontada boost multiplier applied to this row. 1.0 = no boost, 2.0 = active.';
```

Re-apply: `supabase db push`.
(If you've already pushed the migration once, create a new follow-up migration `20260423120001_remontada_xp_audit.sql` with just this ALTER instead.)

- [ ] **Step 3: Run the existing scoring test suite to confirm nothing broke**

Run: `cd services/pcs-sync && pytest tests/test_scoring.py tests/test_scoring_gt.py -v`
Expected: all existing tests still pass (boost defaults to 1.0, legacy behavior unchanged).

- [ ] **Step 4: Commit**

```bash
git add services/pcs-sync/scoring.py supabase/migrations/
git commit -m "feat(scoring): apply remontada boost multiplier at xp computation"
```

---

## Task 8: Wire pre/post snapshot + trigger pass into scoring.py

**Files:**
- Modify: `services/pcs-sync/scoring.py` (around the ranking snapshot section, ~line 426)
- Test: `services/pcs-sync/tests/test_remontada_integration.py` (new)

- [ ] **Step 1: Write the integration test harness**

Create `services/pcs-sync/tests/test_remontada_integration.py`:

```python
"""Integration-style test: simulate a stage scoring run that triggers a Remontada overtake.
Uses in-memory fakes for supabase tables (no DB roundtrip)."""
from unittest.mock import MagicMock, patch
import pytest

from remontada import detect_overtakes, record_overtake, snapshot_league_ranking


def test_end_to_end_overtake_records_trigger_and_boost():
    """4-team league: team D at rank 4 overtakes team C at rank 3 during Giro stage 5.
    D ends at rank 3 → IN podium → NOT eligible (see detect_overtakes rule).
    Use 5-team league instead: E (rank 5) overtakes D (rank 4), E ends at rank 4."""

    # Fake supabase: collects calls for later inspection.
    calls = []

    def fake_table(name):
        handle = MagicMock()
        def _record(method):
            def inner(*args, **kwargs):
                calls.append((name, method, args, kwargs))
                resp = MagicMock()
                resp.data = [{}]
                return MagicMock(execute=MagicMock(return_value=resp))
            return inner
        handle.insert = MagicMock(side_effect=_record("insert"))
        handle.upsert = MagicMock(side_effect=_record("upsert"))
        return handle

    supabase = MagicMock()
    supabase.table = MagicMock(side_effect=fake_table)

    before = [("a", 1), ("b", 2), ("c", 3), ("d", 4), ("e", 5)]
    after = [("a", 1), ("b", 2), ("c", 3), ("e", 4), ("d", 5)]
    overtakes = detect_overtakes(before, after)
    assert overtakes == [("e", "d")]

    for overtaker, overtaken in overtakes:
        record_overtake(
            supabase,
            league_id="lg-1",
            gt_identifier="giro-d-italia",
            overtaker_team_id=overtaker,
            overtaken_team_id=overtaken,
            triggered_at_stage=5,
        )

    table_names = [c[0] for c in calls]
    assert "remontada_boost_triggers" in table_names
    assert "remontada_boosts" in table_names
```

- [ ] **Step 2: Run test to confirm it passes as-is (all helpers already implemented)**

Run: `cd services/pcs-sync && pytest tests/test_remontada_integration.py -v`
Expected: PASS.

- [ ] **Step 3: Track which GT stages appear in this pipeline run**

In `services/pcs-sync/scoring.py`, at the top of `calculate_daily_scores`, just after `logger.info(...)` / `errors: list[str] = []` and BEFORE the main per-team scoring loop, add:

```python
    # --- Remontada: identify GT stages in this run (used later for overtake attribution) ---
    from remontada import (
        get_gt_identifier,
        get_stage_number,
        detect_overtakes,
        record_overtake,
    )

    # Map: gt_identifier -> max stage number seen in this batch (used as trigger stage).
    # We use MAX because if two GT stages are scored in one call (unusual), the later one
    # reflects the cumulative state after this run.
    remontada_stage_in_run: dict[str, int] = {}
    for slug in race_slugs:
        gt_id = get_gt_identifier(slug)
        stage_no = get_stage_number(slug)
        if gt_id and stage_no is not None:
            remontada_stage_in_run[gt_id] = max(
                remontada_stage_in_run.get(gt_id, 0), stage_no
            )
```

No baseline ranking snapshot is taken here: we use the existing `team_ranking_daily` table (populated yesterday) as the pre-scoring baseline in Step 4. This avoids duplicate snapshot logic.

- [ ] **Step 4: Complete the snapshot + overtake detection AFTER existing ranking snapshot**

Replace the `# --- Step 5: Snapshot team_ranking_daily ---` block (around line 426) with:

```python
    # --- Step 5: Snapshot team_ranking_daily + Remontada overtake detection ---
    for league_id in league_ids_seen:
        # 5a. Build POST-scoring ranking for this league.
        try:
            league_teams_resp = supabase.table("teams").select(
                "id, cumulative_xp"
            ).eq("league_id", league_id).order(
                "cumulative_xp", desc=True
            ).execute()
            league_rows = league_teams_resp.data or []
            post_snapshot = [(row["id"], rank) for rank, row in enumerate(league_rows, start=1)]

            # 5b. Write the existing daily snapshot (unchanged behavior).
            for rank, row in enumerate(league_rows, start=1):
                supabase.table("team_ranking_daily").upsert({
                    "team_id": row["id"],
                    "date": today,
                    "rank": rank,
                    "cumulative_xp": row["cumulative_xp"],
                }, on_conflict="team_id,date").execute()

            # 5c. Remontada: if this run touched a GT, compare yesterday's ranking to now and trigger.
            if remontada_stage_in_run:
                yesterday_resp = supabase.table("team_ranking_daily").select(
                    "team_id, rank"
                ).eq("date", _previous_snapshot_date(today)).in_(
                    "team_id", [r["id"] for r in league_rows]
                ).execute()
                pre_rows = yesterday_resp.data or []
                pre_snapshot = [(r["team_id"], r["rank"]) for r in pre_rows]
                pre_snapshot.sort(key=lambda x: x[1])

                if pre_snapshot:  # skip leagues with no prior baseline
                    overtakes = detect_overtakes(pre_snapshot, post_snapshot)
                    for gt_id, stage_no in remontada_stage_in_run.items():
                        for overtaker, overtaken in overtakes:
                            record_overtake(
                                supabase,
                                league_id=league_id,
                                gt_identifier=gt_id,
                                overtaker_team_id=overtaker,
                                overtaken_team_id=overtaken,
                                triggered_at_stage=stage_no,
                            )

        except Exception as e:
            logger.error(f"Failed to snapshot/detect for league {league_id}: {e}")
            errors.append(str(e))
```

Also add a helper at module top (below imports, above constants):

```python
def _previous_snapshot_date(today_str: str) -> str:
    """Return yesterday's date string (YYYY-MM-DD) for the ranking comparison baseline."""
    from datetime import date as _date, timedelta
    d = _date.fromisoformat(today_str) if isinstance(today_str, str) else today_str
    return (d - timedelta(days=1)).isoformat()
```

- [ ] **Step 5: Run the full Python test suite**

Run: `cd services/pcs-sync && pytest -v`
Expected: all pass (existing + new remontada tests).

- [ ] **Step 6: Commit**

```bash
git add services/pcs-sync/scoring.py services/pcs-sync/tests/test_remontada_integration.py
git commit -m "feat(scoring): detect GT overtakes and trigger remontada boost after ranking snapshot"
```

---

## Task 9: TypeScript — active boost fetcher

**Files:**
- Create: `apps/web/lib/remontada.ts`

- [ ] **Step 1: Write the fetcher**

```typescript
// apps/web/lib/remontada.ts
// Anti-Runaway Mechanism 1: Remontada Boost — server-side active boost fetch.
// Spec: docs/plans/2026-04-23-anti-runaway-system-design.md §3

import { createClient } from "@/lib/supabase/server";

export type RemontadaBoost = {
  team_id: string;
  gt_identifier: "giro-d-italia" | "tour-de-france" | "vuelta-a-espana";
  triggered_at_stage: number;
  expires_after_stage: number;
  multiplier: number;
  overtaken_team_name: string | null;
  stages_remaining: number; // derived client-side from current GT stage
};

/** Fetch the active Remontada boost for a team in a specific GT, or null. */
export async function getActiveRemontadaBoost(
  teamId: string,
  gtIdentifier: RemontadaBoost["gt_identifier"],
  currentStageNumber: number,
): Promise<RemontadaBoost | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("remontada_boosts")
    .select(
      `team_id, gt_identifier, triggered_at_stage, expires_after_stage, multiplier,
       overtaken:teams!remontada_boosts_overtaken_team_id_fkey(name)`,
    )
    .eq("team_id", teamId)
    .eq("gt_identifier", gtIdentifier)
    .maybeSingle();

  if (error || !data) return null;

  // Active iff currentStageNumber > triggered_at_stage AND <= expires_after_stage.
  if (
    currentStageNumber <= data.triggered_at_stage ||
    currentStageNumber > data.expires_after_stage
  ) {
    return null;
  }

  return {
    team_id: data.team_id,
    gt_identifier: data.gt_identifier,
    triggered_at_stage: data.triggered_at_stage,
    expires_after_stage: data.expires_after_stage,
    multiplier: Number(data.multiplier),
    overtaken_team_name:
      (data.overtaken as { name?: string } | null)?.name ?? null,
    stages_remaining: data.expires_after_stage - currentStageNumber + 1,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: no new type errors introduced.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/remontada.ts
git commit -m "feat(web): getActiveRemontadaBoost server-side fetcher"
```

---

## Task 10: Build the Remontada Boost banner component

**Files:**
- Create: `apps/web/components/remontada-boost-banner.tsx`

- [ ] **Step 1: Build the component following the design system**

```tsx
// apps/web/components/remontada-boost-banner.tsx
// Spec §3.7 — banner displayed on Team > GT sub-tab during an active Remontada Boost.
// Design system: use --accent-default tokens, --radius-lg, text-[length:var(--type-*)] tokens only.

import { Flame } from "lucide-react";

type RemontadaBoostBannerProps = {
  stagesRemaining: number;
  multiplier: number;
  overtakenTeamName: string | null;
};

export function RemontadaBoostBanner({
  stagesRemaining,
  multiplier,
  overtakenTeamName,
}: RemontadaBoostBannerProps) {
  const stageWord = stagesRemaining === 1 ? "stage" : "stages";
  return (
    <div
      className="mx-4 mb-3 mt-2 rounded-[var(--radius-lg)] border border-[var(--accent-default)]/50 bg-[var(--accent-default)]/10 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-[var(--accent-default)]" aria-hidden />
        <span className="text-[length:var(--type-section)] font-semibold text-[var(--text-high)]">
          Remontada Boost active
        </span>
      </div>
      <p className="mt-1 text-[length:var(--type-body)] text-[var(--text-high)]">
        {multiplier}x points for the next {stagesRemaining} {stageWord}
        <span className="text-[var(--text-mid)]">
          {" "}
          · {stagesRemaining} {stageWord} remaining
        </span>
      </p>
      {overtakenTeamName && (
        <p className="mt-0.5 text-[length:var(--type-caption)] text-[var(--text-mid)]">
          Triggered by overtaking {overtakenTeamName}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `cd apps/web && pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/remontada-boost-banner.tsx
git commit -m "feat(web): RemontadaBoostBanner component (design-system compliant)"
```

---

## Task 11: Integrate banner into the GT sub-tab page

**Files:**
- Create: `apps/web/app/(game)/league/[leagueId]/team/gt/_remontada-banner-slot.tsx`
- Modify: `apps/web/app/(game)/league/[leagueId]/team/gt/page.tsx`

- [ ] **Step 1: Build the server-component slot that fetches boost state**

Create `apps/web/app/(game)/league/[leagueId]/team/gt/_remontada-banner-slot.tsx`:

```tsx
// Server component: fetches active boost and renders the banner if any.
// Kept as a separate file so the banner is easy to mount/unmount in the page.

import { RemontadaBoostBanner } from "@/components/remontada-boost-banner";
import { getActiveRemontadaBoost, type RemontadaBoost } from "@/lib/remontada";

type Props = {
  teamId: string;
  gtIdentifier: RemontadaBoost["gt_identifier"];
  currentStageNumber: number;
};

export async function RemontadaBannerSlot({
  teamId,
  gtIdentifier,
  currentStageNumber,
}: Props) {
  const boost = await getActiveRemontadaBoost(
    teamId,
    gtIdentifier,
    currentStageNumber,
  );
  if (!boost) return null;
  return (
    <RemontadaBoostBanner
      stagesRemaining={boost.stages_remaining}
      multiplier={boost.multiplier}
      overtakenTeamName={boost.overtaken_team_name}
    />
  );
}
```

- [ ] **Step 2: Mount the slot in the GT page**

Read the current contents of `apps/web/app/(game)/league/[leagueId]/team/gt/page.tsx` first. Then add:

At the top of the default exported component's returned JSX (before any existing children), insert:

```tsx
import { RemontadaBannerSlot } from "./_remontada-banner-slot";
// ...existing imports

// Inside the component, after the existing data fetching but before the returned JSX:
//   const { gtIdentifier, currentStageNumber } = await resolveCurrentGtStage(leagueId);
// If those helpers don't exist yet, fall back to reading the current GT from `leagues.active_gt_identifier`
// and `leagues.active_gt_stage_number` fields, or derive from today's date + GT calendar.

// In the JSX:
return (
  <>
    {gtIdentifier && currentStageNumber && (
      <RemontadaBannerSlot
        teamId={team.id}
        gtIdentifier={gtIdentifier}
        currentStageNumber={currentStageNumber}
      />
    )}
    {/* existing page content */}
  </>
);
```

If `gtIdentifier` / `currentStageNumber` cannot be derived yet, stub them to `null` and ship the banner as a no-op — the scoring pipeline creates boosts correctly regardless; the banner just won't render until those values are wired up. Document this as a known gap for a follow-up task.

- [ ] **Step 3: Start the dev server and verify visually**

Run: `cd apps/web && pnpm dev`
Navigate to `/league/<id>/team/gt` as a team with an active boost in the DB (insert one manually via SQL if needed for smoke test). Expected: banner renders at top with correct text and stages remaining. For a team without a boost, no banner.

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(game)/league/[leagueId]/team/gt/
git commit -m "feat(web): mount RemontadaBannerSlot on Team > GT sub-tab"
```

---

## Task 12: Manual smoke test (end-to-end)

**Files:** none (operational task)

- [ ] **Step 1: Seed a test boost row in local Supabase**

Run via Supabase SQL editor or `psql`:
```sql
-- Adjust team_id and league_id to a real pair in your local data.
insert into remontada_boost_triggers (league_id, gt_identifier, overtaker_team_id, overtaken_team_id, triggered_at_stage)
values ('<LEAGUE_ID>', 'giro-d-italia', '<TEAM_A_ID>', '<TEAM_B_ID>', 3);

insert into remontada_boosts (league_id, team_id, gt_identifier, triggered_at_stage, expires_after_stage, multiplier, overtaken_team_id)
values ('<LEAGUE_ID>', '<TEAM_A_ID>', 'giro-d-italia', 3, 6, 2.0, '<TEAM_B_ID>');
```

- [ ] **Step 2: Log in as team A, navigate to Team > Giro sub-tab**

Expected: banner visible at top with text "Remontada Boost active · 2x points for the next N stages · triggered by overtaking <team B name>".

- [ ] **Step 3: Run Pipeline B for a test Giro stage**

```bash
cd services/pcs-sync
python3 run_pipeline.py post-race --race "race/giro-d-italia/2026/stage-4"
```
Expected: no errors. Check `rider_xp_daily` for team A — rows for stage-4 should have `remontada_mult = 2.0`.

- [ ] **Step 4: Verify anti-ping-pong**

Run:
```sql
select count(*) from remontada_boost_triggers
where league_id = '<LEAGUE_ID>' and gt_identifier = 'giro-d-italia'
  and overtaker_team_id = '<TEAM_A_ID>' and overtaken_team_id = '<TEAM_B_ID>';
```
Expected: 1. Then manually simulate another A→B overtake (by running the scoring pipeline again after artificially lowering team B's XP) and re-query: should still be 1 row.

- [ ] **Step 5: Cleanup test data (or keep for regression testing)**

```sql
delete from remontada_boosts where team_id = '<TEAM_A_ID>';
delete from remontada_boost_triggers where overtaker_team_id = '<TEAM_A_ID>';
```

- [ ] **Step 6: Final commit (docs only if any notes were added)**

If no code changes, no commit needed. If smoke test surfaced gaps, file them as follow-up tasks at the bottom of this plan before closing.

---

## Known gaps / follow-up work

Documented for the next iteration (not blocking for Giro 2026-05-08 MVP):

1. **League ranking 🔥 indicator** (spec §3.7) — badge next to boosted players on the ranking page. Separate small UI task.
2. **Beneficiary notification** (spec §3.7) — requires a notifications table / realtime channel. Out of scope for MVP banner.
3. **Current GT stage derivation** — if `leagues.active_gt_identifier` / `active_gt_stage_number` fields don't already exist, add a helper that infers them from today's date against the WT calendar (`services/pcs-sync/wt_calendar_2026.json`).
4. **Multiple races scored in one pipeline call** — current logic attributes the trigger to the MAX stage number among GT slugs in the batch. If a GT stage + a 1-day Classic are scored together, the GT slug is attributed correctly; but if two different GT stages are scored together (unusual), only the later is attributed. Document this as expected behavior.
5. **Release-aware boost handling** — not required by spec, but if a player releases all their riders mid-boost, the boost persists harmlessly (no points to multiply). No action needed.

---

## Handoff to execution

Plan complete and saved to `docs/plans/2026-04-23-remontada-boost-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch with checkpoints.

Which approach?
