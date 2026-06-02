# Spec A — P1: Data Captures & Level Curve — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stretch the L7/L8 level thresholds and capture three new PCS data points (`breakaway_kms`, `profile_icon`, daily `youth` classification) so the scoring refonte (P2) and Race Team feature (P3) have the data they need.

**Architecture:** Pure data-layer foundation, no scoring-behavior change yet. Three additive migrations (level-curve redefinition with no-regression recompute, two new `race_results` columns, one relaxed CHECK constraint) plus matching extraction code in the Python sync pipeline and the TS level constants. Every change is forward-only (no Giro re-scrape).

**Tech Stack:** Python 3.12 (`services/pcs-sync`, pytest), Supabase Postgres migrations, TypeScript (`apps/web`, vitest), `procyclingstats` lib.

**Source spec:** `docs/superpowers/specs/2026-06-01-spec-a-levels-and-roles-design.md` (sections A1, A3/A4 captures, A2 youth daily).

**Project rules:** Rule #2 — schema changes via migration only. App text English. Migrations applied to **prod** (`supabase db push --linked`) require **explicit user confirmation** (CLAUDE.md) — never auto-push. Test locally first (`supabase db reset` on Colima).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `services/pcs-sync/scoring.py:35` | `LEVEL_THRESHOLDS` constant (Python source of truth) | Modify |
| `apps/web/lib/levels.ts` | `LEVELS[].xp` (TS source of truth) | Modify |
| `supabase/migrations/20260602100000_spec_a_level_curve_l7_l8.sql` | Redefine `compute_level()` + no-regression recompute | Create |
| `supabase/migrations/20260602100100_race_results_breakaway_profile.sql` | Add `breakaway_kms`, `profile_icon` columns | Create |
| `supabase/migrations/20260602100200_daily_classif_allow_youth.sql` | Allow `'youth'` in `classification_type` CHECK | Create |
| `services/pcs-sync/sync_race.py` | Extract the 3 new fields during import | Modify |
| `services/pcs-sync/tests/test_sync_race.py` | Extraction tests | Modify |
| `services/pcs-sync/tests/test_scoring.py` | `compute_level` assertions | Modify |
| `services/pcs-sync/tests/test_scoring_levels.py` | New-threshold + no-regression assertions | Modify |
| `docs/GAME_RULES.md` | §12.3 level thresholds | Modify |
| `docs/ARCHITECTURE.md` | New columns / classif type | Modify |

`apps/web/lib/levels-sync-check.test.ts` is a drift guard that derives from both sources — it needs no edit, but **must pass** after Task 1.

---

## Task 1: Stretch L7/L8 thresholds (Python + TS constants)

**Files:**
- Modify: `services/pcs-sync/scoring.py:34-35`
- Modify: `apps/web/lib/levels.ts:8-9` (L7, L8 rows)
- Test: `services/pcs-sync/tests/test_scoring.py:151-163`
- Test: `services/pcs-sync/tests/test_scoring_levels.py`

- [ ] **Step 1: Update the failing tests for the new curve**

In `services/pcs-sync/tests/test_scoring.py`, replace the body of `test_compute_level` (lines 151-163) with:

```python
def test_compute_level():
    """compute_level returns correct level for various XP values (8 levels, L7=2600 L8=5000)."""
    from scoring import compute_level

    assert compute_level(0) == 1
    assert compute_level(24) == 1
    assert compute_level(25) == 2
    assert compute_level(149) == 2
    assert compute_level(150) == 3
    assert compute_level(349) == 3
    assert compute_level(350) == 4
    assert compute_level(600) == 5
    assert compute_level(1200) == 6
    assert compute_level(2599) == 6   # below new L7
    assert compute_level(2600) == 7   # new L7
    assert compute_level(4999) == 7   # below new L8
    assert compute_level(5000) == 8   # new L8
    assert compute_level(99999) == 8
```

In `services/pcs-sync/tests/test_scoring_levels.py`, add these two assertions inside `test_no_level_regression_when_xp_below_new_threshold` (right after the existing `assert LEVEL_THRESHOLDS[5] == 1200` line):

```python
    assert LEVEL_THRESHOLDS[6] == 2600, "Lv.7 threshold should be 2600"
    assert LEVEL_THRESHOLDS[7] == 5000, "Lv.8 threshold should be 5000"
```

And append a new test to the same file:

```python
def test_no_regression_at_l7_boundary():
    """Team at Lv.7 with 2559 XP (real league: Leopard) stays Lv.7 even though 2559 < 2600."""
    from scoring import compute_level
    assert compute_level(2559) == 6  # mathematically L6 under the stretched curve
    current_level = 7
    effective = max(current_level, compute_level(2559))
    assert effective == 7  # grandfathered, never regress
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_scoring.py::test_compute_level tests/test_scoring_levels.py -v`
Expected: FAIL — `compute_level(2600)` returns 8 (old curve) not 7; `LEVEL_THRESHOLDS[6]` is 1800 not 2600.

- [ ] **Step 3: Update the Python constant**

In `services/pcs-sync/scoring.py`, replace lines 34-35:

```python
# Level thresholds — must match apps/web/lib/levels.ts (8 levels). L7/L8 stretched (Spec A A1).
LEVEL_THRESHOLDS = [0, 25, 150, 350, 600, 1200, 2600, 5000]
```

- [ ] **Step 4: Update the TS constant**

In `apps/web/lib/levels.ts`, change the `xp` value on the L7 and L8 rows only:

```typescript
  { level: 7, xp: 2600, slots: 12, pool: "#4-600",   poolMin: 4,   strategy: "Age",         maxActive: 3, sponsor: null },
  { level: 8, xp: 5000, slots: 12, pool: "#1-600",   poolMin: 1,   strategy: null,          maxActive: 3, sponsor: "T6 UAE · 1.25M" },
```

- [ ] **Step 5: Run Python + TS tests to verify they pass**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_scoring.py::test_compute_level tests/test_scoring_levels.py -v`
Expected: PASS

Run: `cd apps/web && pnpm vitest run lib/levels-sync-check.test.ts`
Expected: PASS (TS `LEVELS` xp values now equal Python `LEVEL_THRESHOLDS`).

- [ ] **Step 6: Commit**

```bash
git add services/pcs-sync/scoring.py apps/web/lib/levels.ts services/pcs-sync/tests/test_scoring.py services/pcs-sync/tests/test_scoring_levels.py
git commit -m "feat(levels): stretch L7=2600 L8=5000 thresholds (Spec A A1)"
```

---

## Task 2: Level-curve migration (`compute_level` + no-regression recompute)

**Files:**
- Create: `supabase/migrations/20260602100000_spec_a_level_curve_l7_l8.sql`
- Create: `supabase/migrations/_rollback/20260602100000_spec_a_level_curve_l7_l8.down.sql`

**Why GREATEST:** The thresholds are *raised*, so a plain `level = compute_level(xp)` would **demote** any team currently at L7/L8 whose XP now falls below the new bar (e.g. Leopard 2559 → would become L6). `GREATEST(level, compute_level(...))` preserves the existing level — matching the Python runtime grandfather rule at `scoring.py:676`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260602100000_spec_a_level_curve_l7_l8.sql`:

```sql
-- Spec A (A1) — stretch L7/L8 thresholds.
-- New: L7 = 2600 (was 1800), L8 = 5000 (was 2400). L1-L6 unchanged.
-- Source of truth: apps/web/lib/levels.ts and services/pcs-sync/scoring.py.

CREATE OR REPLACE FUNCTION public.compute_level(xp numeric) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN xp >= 5000 THEN 8
    WHEN xp >= 2600 THEN 7
    WHEN xp >= 1200 THEN 6
    WHEN xp >=  600 THEN 5
    WHEN xp >=  350 THEN 4
    WHEN xp >=  150 THEN 3
    WHEN xp >=   25 THEN 2
    ELSE 1
  END;
$$;

-- Recompute team levels with NO-REGRESSION: never lower a team below its
-- current level (grandfather rule, matches scoring.py runtime behaviour).
UPDATE public.teams
   SET level = GREATEST(level, public.compute_level(cumulative_xp));
```

- [ ] **Step 2: Write the rollback**

Create `supabase/migrations/_rollback/20260602100000_spec_a_level_curve_l7_l8.down.sql`:

```sql
-- Rollback: restore the pre-stretch curve (L7=1800, L8=2400).
-- NOTE: the no-regression recompute is NOT reversible (old per-team levels are
-- not stored); this only restores the function and re-applies GREATEST.
CREATE OR REPLACE FUNCTION public.compute_level(xp numeric) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN xp >= 2400 THEN 8
    WHEN xp >= 1800 THEN 7
    WHEN xp >= 1200 THEN 6
    WHEN xp >=  600 THEN 5
    WHEN xp >=  350 THEN 4
    WHEN xp >=  150 THEN 3
    WHEN xp >=   25 THEN 2
    ELSE 1
  END;
$$;

UPDATE public.teams
   SET level = GREATEST(level, public.compute_level(cumulative_xp));
```

- [ ] **Step 3: Apply + verify locally**

Start the local stack if needed (`colima start --cpu 4 --memory 6` then `supabase start --exclude vector,edge-runtime,logflare,imgproxy,studio,mailpit`), then:

Run: `supabase db reset`
Then verify the function:
Run: `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "SELECT public.compute_level(2599) AS l6, public.compute_level(2600) AS l7, public.compute_level(4999) AS still7, public.compute_level(5000) AS l8;"`
Expected: `l6=6, l7=7, still7=7, l8=8`

- [ ] **Step 4: Push to remote (REQUIRES USER CONFIRMATION)**

⚠️ This migration recomputes **production** `teams.level`. Per CLAUDE.md, **ask the user before running**:

Run (only after the user confirms): `supabase db push --linked`

Then verify no real team regressed in the test league:
Run: `docker exec` is local-only — instead query remote via the pcs-sync client or Supabase SQL. Confirm Leopard (`cumulative_xp` 2559) is still `level = 7`, not 6.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260602100000_spec_a_level_curve_l7_l8.sql supabase/migrations/_rollback/20260602100000_spec_a_level_curve_l7_l8.down.sql
git commit -m "feat(db): stretch level curve L7=2600 L8=5000 with no-regression recompute (Spec A A1)"
```

---

## Task 3: `race_results` capture columns migration

**Files:**
- Create: `supabase/migrations/20260602100100_race_results_breakaway_profile.sql`
- Create: `supabase/migrations/_rollback/20260602100100_race_results_breakaway_profile.down.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260602100100_race_results_breakaway_profile.sql`:

```sql
-- Spec A (A3/A4) — capture breakaway distance + stage profile for scoring (P2).
ALTER TABLE public.race_results
  ADD COLUMN IF NOT EXISTS breakaway_kms numeric,
  ADD COLUMN IF NOT EXISTS profile_icon  text;

COMMENT ON COLUMN public.race_results.breakaway_kms IS
  'Km the rider spent in the breakaway (PCS Stage.results breakaway_kms). NULL if unknown.';
COMMENT ON COLUMN public.race_results.profile_icon IS
  'PCS stage profile icon p0-p5 (p1 flat … p5 summit finish). NULL for non-stage results (e.g. GC).';
```

(Forward-only: no backfill of historical Giro rows — see spec §Q12.)

- [ ] **Step 2: Write the rollback**

Create `supabase/migrations/_rollback/20260602100100_race_results_breakaway_profile.down.sql`:

```sql
ALTER TABLE public.race_results
  DROP COLUMN IF EXISTS breakaway_kms,
  DROP COLUMN IF EXISTS profile_icon;
```

- [ ] **Step 3: Apply + verify locally**

Run: `supabase db reset`
Run: `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='race_results' AND column_name IN ('breakaway_kms','profile_icon') ORDER BY column_name;"`
Expected: two rows — `breakaway_kms | numeric`, `profile_icon | text`.

- [ ] **Step 4: Push to remote (additive — confirm with user, low risk)**

Run (after user OK): `supabase db push --linked`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260602100100_race_results_breakaway_profile.sql supabase/migrations/_rollback/20260602100100_race_results_breakaway_profile.down.sql
git commit -m "feat(db): add race_results.breakaway_kms + profile_icon columns (Spec A A3/A4)"
```

---

## Task 4: Extract `breakaway_kms` + `profile_icon` in `import_race_results`

**Files:**
- Modify: `services/pcs-sync/sync_race.py` (add helper after `_detect_itt`, lines ~87; add fields in `import_race_results` row, lines ~121 & ~144-153)
- Test: `services/pcs-sync/tests/test_sync_race.py` (add 2 tests after line 297)

- [ ] **Step 1: Write the failing tests**

Append to `services/pcs-sync/tests/test_sync_race.py` (after `test_import_race_results_flag_false_for_non_itt_stage`, line 297):

```python
async def test_import_race_results_captures_breakaway_and_profile():
    """Stage results carry breakaway_kms (per rider) + the stage profile_icon into the payload."""
    import sync_race

    fake_results = [
        {"rider_url": PCS_SLUG_MATCH, "pcs_points": 50, "rank": 1, "breakaway_kms": 142.0}
    ]
    mock_stage_instance = MagicMock()
    mock_stage_instance.results.return_value = fake_results
    mock_stage_instance.stage_type.return_value = "Road stage"
    mock_stage_instance.profile_icon.return_value = "p1"
    mock_stage = MagicMock(return_value=mock_stage_instance)

    sb = make_supabase([{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}], [])

    with _patch_fetch_html(), patch("sync_race.Stage", mock_stage):
        await sync_race.import_race_results(
            sb, page=MagicMock(),
            race_slug="race/paris-nice/2026", race_name="Paris-Nice",
            race_date="2026-03-08", stage_url="race/paris-nice/2026/stage-2",
        )

    payload = sb._last_upsert_payload("race_results")
    assert payload["breakaway_kms"] == 142.0
    assert payload["profile_icon"] == "p1"


async def test_import_race_results_profile_and_breakaway_none_when_unavailable():
    """Missing breakaway_kms key → None; empty profile_icon → None (no crash)."""
    import sync_race

    fake_results = [{"rider_url": PCS_SLUG_MATCH, "pcs_points": 10, "rank": 8}]
    mock_stage_instance = MagicMock()
    mock_stage_instance.results.return_value = fake_results
    mock_stage_instance.stage_type.return_value = "Road stage"
    mock_stage_instance.profile_icon.return_value = None
    mock_stage = MagicMock(return_value=mock_stage_instance)

    sb = make_supabase([{"id": RIDER_ID, "pcs_slug": PCS_SLUG_MATCH}], [])

    with _patch_fetch_html(), patch("sync_race.Stage", mock_stage):
        await sync_race.import_race_results(
            sb, page=MagicMock(),
            race_slug=RACE_SLUG, race_name=RACE_NAME, race_date=RACE_DATE,
            stage_url=STAGE_URL,
        )

    payload = sb._last_upsert_payload("race_results")
    assert payload["breakaway_kms"] is None
    assert payload["profile_icon"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_sync_race.py -k "breakaway or profile" -v`
Expected: FAIL — `KeyError: 'breakaway_kms'` / `'profile_icon'` (fields not in payload yet).

- [ ] **Step 3: Add the profile helper**

In `services/pcs-sync/sync_race.py`, add this function immediately after `_detect_itt` (after line 86):

```python
def _stage_profile_icon(stage) -> Optional[str]:
    """Return the PCS profile icon (p0-p5) for a stage, or None if unavailable."""
    try:
        attr = getattr(stage, "profile_icon", None)
        val = attr() if callable(attr) else attr
    except Exception:
        return None
    if not val:
        return None
    return str(val).strip().lower()
```

- [ ] **Step 4: Read the profile once + add both fields to the row**

In `import_race_results`, after `stage = Stage(fetch_url, html=html, update_html=False)` (line 121) add:

```python
    profile_icon = _stage_profile_icon(stage)
```

Then in the `row` dict (lines 144-153), add two keys after `"is_itt": _detect_itt(stage),`:

```python
                    "is_itt": _detect_itt(stage),
                    "breakaway_kms": entry.get("breakaway_kms"),
                    "profile_icon": profile_icon,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_sync_race.py -v`
Expected: PASS (new tests pass, existing `is_itt` tests still pass).

- [ ] **Step 6: Commit**

```bash
git add services/pcs-sync/sync_race.py services/pcs-sync/tests/test_sync_race.py
git commit -m "feat(sync): capture breakaway_kms + profile_icon in import_race_results (Spec A A3/A4)"
```

---

## Task 5: Allow `'youth'` in `classification_type` CHECK

**Files:**
- Create: `supabase/migrations/20260602100200_daily_classif_allow_youth.sql`
- Create: `supabase/migrations/_rollback/20260602100200_daily_classif_allow_youth.down.sql`

**Note:** `classification_type` is **not** a Postgres enum — it is a TEXT column with an inline CHECK constraint on `gt_daily_classifications` (auto-named `gt_daily_classifications_classification_type_check`). We drop and re-add it.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260602100200_daily_classif_allow_youth.sql`:

```sql
-- Spec A (A2) — allow 'youth' in the daily classification cache so the best-young
-- jersey can be scraped + scored daily alongside gc/points/kom (scoring in P2).
ALTER TABLE public.gt_daily_classifications
  DROP CONSTRAINT IF EXISTS gt_daily_classifications_classification_type_check;

ALTER TABLE public.gt_daily_classifications
  ADD CONSTRAINT gt_daily_classifications_classification_type_check
  CHECK (classification_type IN ('gc', 'points', 'kom', 'youth'));
```

- [ ] **Step 2: Write the rollback**

Create `supabase/migrations/_rollback/20260602100200_daily_classif_allow_youth.down.sql`:

```sql
-- Rollback: remove 'youth' first (will fail loudly if youth rows exist — clean them first).
DELETE FROM public.gt_daily_classifications WHERE classification_type = 'youth';

ALTER TABLE public.gt_daily_classifications
  DROP CONSTRAINT IF EXISTS gt_daily_classifications_classification_type_check;

ALTER TABLE public.gt_daily_classifications
  ADD CONSTRAINT gt_daily_classifications_classification_type_check
  CHECK (classification_type IN ('gc', 'points', 'kom'));
```

- [ ] **Step 3: Apply + verify locally**

Run: `supabase db reset`
Run: `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "INSERT INTO public.gt_daily_classifications (race_slug, stage, rider_id, classification_type, rank) SELECT 'race/test/2026/stage-1','stage-1', id, 'youth', 1 FROM public.riders LIMIT 1 RETURNING classification_type;"`
Expected: returns one row with `classification_type = youth` (the insert succeeds → constraint accepts youth). Then clean up:
Run: `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "DELETE FROM public.gt_daily_classifications WHERE race_slug='race/test/2026/stage-1';"`

- [ ] **Step 4: Push to remote (additive — confirm with user)**

Run (after user OK): `supabase db push --linked`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260602100200_daily_classif_allow_youth.sql supabase/migrations/_rollback/20260602100200_daily_classif_allow_youth.down.sql
git commit -m "feat(db): allow youth in gt_daily_classifications classification_type (Spec A A2)"
```

---

## Task 6: Scrape daily `youth` classification in `import_daily_classifications`

**Files:**
- Modify: `services/pcs-sync/sync_race.py:501` (counts dict) and `:512-516` (fetchers list) + docstring
- Test: `services/pcs-sync/tests/test_sync_race.py` (fix 2 existing tests + add 1)

**Gotcha:** the two existing daily-classif tests do not mock `.youth()`. Once `youth` is in the fetchers, `stage.youth()` on an un-stubbed `MagicMock` returns a non-iterable mock and the (un-tried) `for entry in entries` loop raises `TypeError`. They must stub `youth.return_value = []`.

- [ ] **Step 1: Write the failing test + patch the existing two**

In `services/pcs-sync/tests/test_sync_race.py`, add `mock_stage_instance.youth.return_value = []` to **both** existing tests — `test_import_daily_classifications_upserts_three_types` (after line 315) and `test_import_daily_classifications_skips_unknown_riders` (after line 358).

Then append a new test:

```python
async def test_import_daily_classifications_includes_youth():
    """youth classification is scraped + upserted alongside gc/points/kom."""
    import sync_race

    mock_stage_instance = MagicMock()
    mock_stage_instance.gc.return_value = []
    mock_stage_instance.points.return_value = []
    mock_stage_instance.kom.return_value = []
    mock_stage_instance.youth.return_value = [
        {"rider_url": "rider/young", "rank": 1},
        {"rider_url": "rider/young2", "rank": 2},
    ]
    mock_stage = MagicMock(return_value=mock_stage_instance)

    stage_url = "race/giro-d-italia/2026/stage-4"
    sb = make_supabase([
        {"id": "rid-y1", "pcs_slug": "rider/young"},
        {"id": "rid-y2", "pcs_slug": "rider/young2"},
    ])

    with _patch_fetch_html(), patch("sync_race.Stage", mock_stage):
        result = await sync_race.import_daily_classifications(
            sb, page=MagicMock(),
            race_slug="race/giro-d-italia/2026", stage_url=stage_url,
        )

    assert result["youth"] == 2
    classif_rows = sb.upserts["gt_daily_classifications"]
    youth_rows = [r for r in classif_rows if r["classification_type"] == "youth"]
    assert len(youth_rows) == 2
    assert all(r["race_slug"] == stage_url for r in youth_rows)
```

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_sync_race.py -k daily_classifications -v`
Expected: `test_import_daily_classifications_includes_youth` FAILS with `KeyError: 'youth'` (counts dict has no youth key); the two patched tests PASS.

- [ ] **Step 3: Add youth to counts + fetchers**

In `services/pcs-sync/sync_race.py`, change line 501:

```python
    counts = {"gc": 0, "points": 0, "kom": 0, "youth": 0}
```

And add a fetcher to the list (lines 512-516) — append after the `kom` entry:

```python
    fetchers = [
        ("gc", lambda: stage.gc()[:50]),
        ("points", lambda: stage.points()[:20]),
        ("kom", lambda: stage.kom()[:10]),
        ("youth", lambda: stage.youth()[:20]),
    ]
```

Update the docstring (lines 495-500) to mention youth, e.g. change "Fetch gc/points/kom classifications" to "Fetch gc/points/kom/youth classifications" and "Stores top 50 GC, top 20 points, top 10 KOM" to "... top 20 youth".

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_sync_race.py -v`
Expected: PASS (all daily-classif tests green).

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/sync_race.py services/pcs-sync/tests/test_sync_race.py
git commit -m "feat(sync): scrape daily youth classification (Spec A A2)"
```

---

## Task 7: Update living docs

**Files:**
- Modify: `docs/GAME_RULES.md:361`
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Update GAME_RULES level thresholds**

In `docs/GAME_RULES.md`, line 361 currently reads:

```
- **Nouveaux seuils** : Lv.6 = 1 200 XP | Lv.7 = 1 800 XP | Lv.8 = 2 400 XP (Lv.1–5 inchangés).
```

Replace the L7/L8 values:

```
- **Nouveaux seuils** : Lv.6 = 1 200 XP | Lv.7 = 2 600 XP | Lv.8 = 5 000 XP (Lv.1–5 inchangés). *(Spec A A1, 2026-06-02 : L7/L8 relevés depuis 1 800 / 2 400.)*
```

- [ ] **Step 2: Update ARCHITECTURE.md**

In `docs/ARCHITECTURE.md`, find the `race_results` table description and the `gt_daily_classifications` description; add a one-line note for each:
- `race_results`: add `breakaway_kms numeric` (km in breakaway, NULL if unknown) and `profile_icon text` (PCS p0-p5, NULL on GC) to the column list.
- `gt_daily_classifications`: note `classification_type` now accepts `youth` (in addition to gc/points/kom).
If a "migrations" / changelog section exists, add the three new migration filenames with a one-line purpose each.

- [ ] **Step 3: Commit**

```bash
git add docs/GAME_RULES.md docs/ARCHITECTURE.md
git commit -m "docs: record stretched level curve + new capture columns (Spec A P1)"
```

---

## Task 8: Full-suite verification

- [ ] **Step 1: Python suite**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest -q`
Expected: all pass (focus: `test_sync_race.py`, `test_scoring.py`, `test_scoring_levels.py`).

- [ ] **Step 2: Web suite (level drift guard)**

Run: `cd apps/web && pnpm vitest run lib/levels-sync-check.test.ts`
Expected: PASS.

- [ ] **Step 3: Clean migration replay**

Run: `supabase db reset`
Expected: all migrations apply with no error (the three new ones included), confirming a from-scratch rebuild stays consistent (Rule #2 guarantee).

- [ ] **Step 4: Confirm prod state (if migrations were pushed)**

If the user authorised `supabase db push --linked` in Tasks 2/3/5, confirm:
- `compute_level(2600) = 7`, `compute_level(5000) = 8` on remote.
- No team in the test league (`adaec367…`) regressed a level.
- `race_results` has the two new columns; `gt_daily_classifications` accepts `youth`.

---

## Self-Review

- **Spec coverage:** A1 levels → Tasks 1, 2, 7. A3/A4 capture columns → Tasks 3, 4. A2 youth daily (enum/check + scrape) → Tasks 5, 6. Scoring *behaviour* (A2 multipliers, A3 breakaway math, A4 gating, A7 tactics) is intentionally **out of P1** → P2. Race Team / front doc → **P3**. No P1 gap.
- **No placeholders:** every step has exact code/SQL/commands and expected output.
- **Type consistency:** `_stage_profile_icon` returns `Optional[str]`; column `profile_icon text`; test asserts `"p1"` / `None`. `breakaway_kms` numeric ↔ `entry.get("breakaway_kms")` float/None. `counts["youth"]` ↔ test `result["youth"]`. `LEVEL_THRESHOLDS[6]=2600 / [7]=5000` ↔ `levels.ts` L7 2600 / L8 5000 ↔ migration CASE 2600/5000 — all aligned.
