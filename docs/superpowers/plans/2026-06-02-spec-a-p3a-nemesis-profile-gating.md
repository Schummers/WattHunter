# Spec A — P3a: Nemesis Profile Gating — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate Nemesis tactic activation by stage profile — Nemesis Sprint requires the stage profile ∈ {p1,p2,p3}; Nemesis GC requires ∈ {p3,p4,p5} — by scraping each race's stage profiles up-front from `Race.stages()` and storing them in a new `stage_profiles` table that `place_tactic` consults at activation time.

**Architecture:** A single PCS fetch per race (the race overview page) exposes `profile_icon` for every stage via `Race.stages()` — no per-stage fetch. Profiles persist in a dedicated `stage_profiles` table (one row per stage_slug). The `place_tactic` RPC reads that table and raises a profile-mismatch error for Nemesis tactics on the wrong profile. Forward-only — only seeded for races still to come (Tour de France 2026 onward).

**Tech Stack:** Postgres migration (Supabase remote `uuvshpykvpnhpeondqjt`), Python 3.12 + `procyclingstats` lib (`services/pcs-sync`), pytest + pytest-asyncio.

**Source spec:** `docs/superpowers/specs/2026-06-01-spec-a-levels-and-roles-design.md` (A7 Nemesis profile gating, the Nemesis half deferred from P2).

**Project rules:**
- Rule #2 — schema changes only via migration; never mutate the DB by hand.
- App text English; `place_tactic` error messages too.
- `supabase db push --linked` (prod) requires **explicit user confirmation** per CLAUDE.md — Task 1 + Task 4 each include a confirmation step.
- Python invocations always via the worktree venv symlink: `services/pcs-sync/.venv/bin/python`.

---

## Scope (locked with user 2026-06-02)

**In P3a:**
- New `stage_profiles(race_slug, profile_icon, race_date)` table — one row per stage_slug.
- New `import_stage_profiles(supabase, page, race_slug, race_name)` in `sync_race.py` that reads `Race.stages()` and upserts one row per stage.
- `run_pipeline.py startlists` extended to call `import_stage_profiles` after `import_startlist` (same browser session, same race).
- `place_tactic` RPC v2: rejects `nemesis_sprint` on a stage whose profile is not in `('p1','p2','p3')`, and `nemesis_gc` on a stage not in `('p3','p4','p5')`. Existing GT phase + cutoff + same-league + ≥-XP validations unchanged.
- Backfill: run `python run_pipeline.py startlists` for the Tour, the Vuelta, and any remaining 1-week stage races of 2026 to seed `stage_profiles`.

**Not in P3a (P3b/P3c):**
- Generalizing `gt_squad` / `gt_tactic_activations` to `race_slug` (A9 data shape).
- 1-week Race Team scoring (A9 scoring).
- Front: profile-icon chip on the tactic placement UI, error surfacing (A8 + tactic-modal touch-up).

**Forward-only:** the Giro 2026 is not re-scored or backfilled. The Tour de France is the first race where Nemesis profile gating actually fires.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/migrations/20260603000000_stage_profiles.sql` | new `stage_profiles` table + RLS read-public | Create |
| `supabase/migrations/_rollback/20260603000000_stage_profiles.down.sql` | rollback | Create |
| `supabase/migrations/20260603000100_place_tactic_profile_gating.sql` | `CREATE OR REPLACE FUNCTION place_tactic` with Nemesis profile validation | Create |
| `supabase/migrations/_rollback/20260603000100_place_tactic_profile_gating.down.sql` | restore the pre-P3a `place_tactic` body (copy of `20260510100000`) | Create |
| `services/pcs-sync/sync_race.py` | new `import_stage_profiles`; helper is added next to `import_startlist` and reuses existing `_stage_profile_icon` semantics | Modify |
| `services/pcs-sync/run_pipeline.py` | `run_startlists` calls `import_stage_profiles`; optional standalone `stage-profiles` subcommand for batch seeding | Modify |
| `services/pcs-sync/tests/test_sync_race.py` | unit tests for `import_stage_profiles` | Modify |
| `apps/web/lib/database.types.ts` | regenerated (new table) | Regenerate |
| `docs/GAME_RULES.md` | §13 Nemesis profile gating note + §11 constants (sprint/GC profile sets) | Modify |
| `docs/ARCHITECTURE.md` | new table, RPC change, pipeline step | Modify |

---

## Task 0: Worktree Python environment

Already completed when entering this worktree:
- `services/pcs-sync/.venv` symlinked from the main repo's pcs-sync venv.
- Baseline `pytest -q` from `services/pcs-sync` → **187 passed, 4 warnings**.

If the agent picks up this plan in a fresh worktree:

- [ ] **Step 1: Symlink the venv**

Run: `ln -s /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync/.venv services/pcs-sync/.venv`

- [ ] **Step 2: Confirm baseline**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest -q`
Expected: `187 passed` (exit 0).

---

## Task 1: `stage_profiles` table migration

**Files:**
- Create: `supabase/migrations/20260603000000_stage_profiles.sql`
- Create: `supabase/migrations/_rollback/20260603000000_stage_profiles.down.sql`

**Why:** the new RPC needs a per-stage source of truth for `profile_icon` that lives in the DB (so the RPC remains pure SQL). Keep it minimal — one row per stage_slug. RLS read-public matches `race_startlists` and `gt_final_classifications`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260603000000_stage_profiles.sql`:

```sql
-- Spec A (A7) — pre-race stage profile lookup table.
-- One row per stage_slug ("race/<race>/<year>/stage-N"), populated by the
-- startlists pipeline from Race.stages() (single page fetch per race).
-- Consumed by place_tactic for Nemesis profile gating
-- (Nemesis Sprint requires p1/p2/p3, Nemesis GC requires p3/p4/p5).
CREATE TABLE IF NOT EXISTS public.stage_profiles (
  race_slug      text  PRIMARY KEY,
  profile_icon   text  NOT NULL CHECK (profile_icon IN ('p0','p1','p2','p3','p4','p5')),
  race_date      date,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stage_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read stage_profiles"
  ON public.stage_profiles FOR SELECT USING (true);

COMMENT ON TABLE public.stage_profiles IS
  'Pre-race stage profile icon (p0-p5) per race_slug. Populated by run_pipeline.py startlists. Consumed by place_tactic Nemesis gating (Spec A A7).';

COMMENT ON COLUMN public.stage_profiles.profile_icon IS
  'PCS profile icon: p0=unknown, p1=flat, p2=hilly-flat-finish, p3=hilly-uphill-finish, p4=mountain-flat-finish, p5=mountain-summit-finish.';
```

- [ ] **Step 2: Write the rollback**

Create `supabase/migrations/_rollback/20260603000000_stage_profiles.down.sql`:

```sql
DROP TABLE IF EXISTS public.stage_profiles;
```

- [ ] **Step 3: Apply + verify locally**

If Colima/Supabase local stack is not up, start it: `colima start --cpu 4 --memory 6 && supabase start --exclude vector,edge-runtime,logflare,imgproxy,studio,mailpit`

Run: `supabase db reset`
Run: `docker exec -i supabase_db_WattHunter psql -U postgres -d postgres -c "\d public.stage_profiles"`
Expected: shows columns `race_slug | text | not null`, `profile_icon | text | not null`, `race_date | date`, plus the CHECK constraint and the PK on `race_slug`.

- [ ] **Step 4: Push to prod (ADDITIVE — REQUIRES USER CONFIRMATION)**

⚠️ Per CLAUDE.md, ask the user before running. Migration is additive (new table) and low-risk.

Run (only after the user confirms): `supabase db push --linked`

- [ ] **Step 5: Regenerate TypeScript types**

Run: `cd apps/web && pnpm supabase gen types typescript --linked > lib/database.types.ts`

Verify: `grep -n "stage_profiles" apps/web/lib/database.types.ts` returns 3+ hits (the Row / Insert / Update interfaces).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260603000000_stage_profiles.sql supabase/migrations/_rollback/20260603000000_stage_profiles.down.sql apps/web/lib/database.types.ts
git commit -m "feat(db): add stage_profiles for pre-race profile lookup (Spec A A7)"
```

---

## Task 2: `import_stage_profiles` pipeline helper

The key win: `Race.stages()` returns one dict per stage including `profile_icon`, `stage_url`, `stage_name`, `date` from a single overview-page fetch. No per-stage scrape needed.

**Files:**
- Modify: `services/pcs-sync/sync_race.py` (add `import_stage_profiles` right after `import_startlist`)
- Modify: `services/pcs-sync/tests/test_sync_race.py` (append tests)

### Why an inline date for upserts

`Race.stages()` returns `date` in `"MM-DD"` format (per the PCS lib docstring inspected at plan time). We combine it with the year inferred from the slug (`/2026`) to produce an ISO `race_date`. This is best-effort: if a stage's `date` field is missing (rare; older races), we fall back to `NULL` for `race_date` — the RPC reads only `profile_icon`, so a missing date does not affect gating.

- [ ] **Step 1: Write the failing tests**

Append to `services/pcs-sync/tests/test_sync_race.py`:

```python
# ---------------------------------------------------------------------------
# 12. import_stage_profiles — Spec A P3a
# ---------------------------------------------------------------------------


async def test_import_stage_profiles_upserts_one_row_per_stage():
    """Race.stages() → one stage_profiles row per stage, profile_icon + date carried through."""
    import sync_race

    fake_stages = [
        {"stage_url": "race/tour-de-france/2026/stage-1", "profile_icon": "p1",
         "date": "07-04", "stage_name": "Stage 1"},
        {"stage_url": "race/tour-de-france/2026/stage-2", "profile_icon": "p3",
         "date": "07-05", "stage_name": "Stage 2"},
        {"stage_url": "race/tour-de-france/2026/stage-3", "profile_icon": "p5",
         "date": "07-06", "stage_name": "Stage 3"},
    ]

    mock_race_instance = MagicMock()
    mock_race_instance.is_one_day_race.return_value = False
    mock_race_instance.stages.return_value = fake_stages
    mock_race = MagicMock(return_value=mock_race_instance)

    sb = make_supabase()  # only stage_profiles upserts will happen

    with _patch_fetch_html(), patch("sync_race.Race", mock_race):
        result = await sync_race.import_stage_profiles(
            sb, page=MagicMock(),
            race_slug="race/tour-de-france/2026",
            race_name="Tour de France",
        )

    assert result == {"imported": 3, "skipped": 0, "total_stages": 3}
    upserts = sb.upserts["stage_profiles"]
    by_slug = {r["race_slug"]: r for r in upserts}
    assert by_slug["race/tour-de-france/2026/stage-1"]["profile_icon"] == "p1"
    assert by_slug["race/tour-de-france/2026/stage-1"]["race_date"] == "2026-07-04"
    assert by_slug["race/tour-de-france/2026/stage-2"]["profile_icon"] == "p3"
    assert by_slug["race/tour-de-france/2026/stage-3"]["profile_icon"] == "p5"


async def test_import_stage_profiles_one_day_race_returns_empty():
    """One-day races (no stages) → no upserts, total_stages=0."""
    import sync_race

    mock_race_instance = MagicMock()
    mock_race_instance.is_one_day_race.return_value = True
    mock_race_instance.stages.return_value = []
    mock_race = MagicMock(return_value=mock_race_instance)

    sb = make_supabase()

    with _patch_fetch_html(), patch("sync_race.Race", mock_race):
        result = await sync_race.import_stage_profiles(
            sb, page=MagicMock(),
            race_slug="race/milano-sanremo/2026",
            race_name="Milano-Sanremo",
        )

    assert result == {"imported": 0, "skipped": 0, "total_stages": 0}
    assert "stage_profiles" not in sb.upserts


async def test_import_stage_profiles_skips_stage_with_missing_profile():
    """A stage row with profile_icon=None is skipped (not upserted with NULL — CHECK violation)."""
    import sync_race

    fake_stages = [
        {"stage_url": "race/x/2026/stage-1", "profile_icon": "p1", "date": "03-08"},
        {"stage_url": "race/x/2026/stage-2", "profile_icon": None,  "date": "03-09"},
        {"stage_url": "race/x/2026/stage-3", "profile_icon": "",    "date": "03-10"},
    ]

    mock_race_instance = MagicMock()
    mock_race_instance.is_one_day_race.return_value = False
    mock_race_instance.stages.return_value = fake_stages
    mock_race = MagicMock(return_value=mock_race_instance)

    sb = make_supabase()

    with _patch_fetch_html(), patch("sync_race.Race", mock_race):
        result = await sync_race.import_stage_profiles(
            sb, page=MagicMock(),
            race_slug="race/x/2026",
            race_name="X",
        )

    assert result == {"imported": 1, "skipped": 2, "total_stages": 3}
    upserts = sb.upserts["stage_profiles"]
    assert len(upserts) == 1
    assert upserts[0]["race_slug"] == "race/x/2026/stage-1"


async def test_import_stage_profiles_falls_back_when_date_missing():
    """A stage without a `date` field → race_date=None in the payload; profile still imported."""
    import sync_race

    fake_stages = [
        {"stage_url": "race/x/2026/stage-1", "profile_icon": "p2"},  # no date key
    ]

    mock_race_instance = MagicMock()
    mock_race_instance.is_one_day_race.return_value = False
    mock_race_instance.stages.return_value = fake_stages
    mock_race = MagicMock(return_value=mock_race_instance)

    sb = make_supabase()

    with _patch_fetch_html(), patch("sync_race.Race", mock_race):
        result = await sync_race.import_stage_profiles(
            sb, page=MagicMock(),
            race_slug="race/x/2026",
            race_name="X",
        )

    assert result["imported"] == 1
    payload = sb._last_upsert_payload("stage_profiles")
    assert payload["profile_icon"] == "p2"
    assert payload["race_date"] is None
```

> `make_supabase()` (without arguments) returns a mock whose `.table()` calls all return empty selects and record their `.upsert()` payloads into `sb.upserts`. The existing `_patch_fetch_html` helper above the tests is reused.

- [ ] **Step 2: Run the new tests to confirm they fail**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_sync_race.py -k "import_stage_profiles" -v`
Expected: FAIL — `sync_race.import_stage_profiles` is undefined.

- [ ] **Step 3: Implement `import_stage_profiles`**

In `services/pcs-sync/sync_race.py`, add the helper immediately after `import_startlist` (around line 691). The helper reuses the existing `Race` import (already at line 13). Insert:

```python
def _stage_year_from_slug(race_slug: str) -> Optional[int]:
    """Extract the 4-digit year from a race slug like 'race/tour-de-france/2026'."""
    import re
    m = re.search(r"/(\d{4})(?:/|$)", race_slug)
    return int(m.group(1)) if m else None


def _stage_date_from_md(md: Optional[str], year: Optional[int]) -> Optional[str]:
    """Combine a 'MM-DD' string from Race.stages() with the year inferred from the slug.

    Returns an ISO date string ('YYYY-MM-DD') or None on missing/invalid input.
    """
    if not md or not year:
        return None
    s = str(md).strip()
    # Expect 'MM-DD'; tolerate 'M-D' and pad
    parts = s.split("-")
    if len(parts) != 2:
        return None
    try:
        mm = int(parts[0])
        dd = int(parts[1])
        return f"{year:04d}-{mm:02d}-{dd:02d}"
    except ValueError:
        return None


async def import_stage_profiles(
    supabase: Client,
    page,
    race_slug: str,
    race_name: str,
) -> Dict[str, int]:
    """Scrape every stage's profile_icon from the race overview page (Race.stages())
    and upsert one row per stage into stage_profiles.

    One fetch per race — no per-stage scraping. Skips stages with no profile_icon
    (CHECK constraint forbids NULL). Returns counts.
    """
    html = await fetch_html(page, race_slug)
    race = Race(race_slug, html=html, update_html=False)

    if race.is_one_day_race():
        return {"imported": 0, "skipped": 0, "total_stages": 0}

    stages = race.stages()
    year = _stage_year_from_slug(race_slug)

    imported = 0
    skipped = 0

    for stage in stages:
        stage_url = stage.get("stage_url") or ""
        raw_icon = stage.get("profile_icon")
        icon = str(raw_icon).strip().lower() if raw_icon else ""
        if not stage_url or not icon:
            skipped += 1
            continue

        race_date = _stage_date_from_md(stage.get("date"), year)
        try:
            supabase.table("stage_profiles").upsert(
                {
                    "race_slug": stage_url,
                    "profile_icon": icon,
                    "race_date": race_date,
                },
                on_conflict="race_slug",
            ).execute()
            imported += 1
        except Exception as exc:
            logger.error("Failed stage_profiles upsert for %s: %s", stage_url, exc)
            skipped += 1

    return {"imported": imported, "skipped": skipped, "total_stages": len(stages)}
```

> Note on `updated_at`: omitted from the payload on purpose — supabase-py would send the string `"now()"`, which Postgres only coerces via the column DEFAULT on INSERT, not on UPDATE. Leaving the column out preserves whatever value is there (it is informational; the RPC reads `profile_icon` only).

- [ ] **Step 4: Re-run the tests — confirm pass**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest tests/test_sync_race.py -k "import_stage_profiles" -v`
Expected: 4 passed.

- [ ] **Step 5: Run the full pcs-sync suite — confirm no regression**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest -q`
Expected: `191 passed` (was 187 + 4 new).

- [ ] **Step 6: Commit**

```bash
git add services/pcs-sync/sync_race.py services/pcs-sync/tests/test_sync_race.py
git commit -m "feat(pcs-sync): import_stage_profiles scrapes stage profile_icon per race (Spec A A7)"
```

---

## Task 3: Wire `import_stage_profiles` into the startlists pipeline

`run_pipeline.py startlists` already opens a browser session for one race. We piggyback the stage-profile scrape onto the same session — no extra browser bring-up cost.

**Files:**
- Modify: `services/pcs-sync/run_pipeline.py` (`run_startlists`, lines ~675-706)

- [ ] **Step 1: Update `run_startlists`**

In `services/pcs-sync/run_pipeline.py`, modify `run_startlists` to import and call `import_stage_profiles` immediately after `import_startlist`:

```python
async def run_startlists(race_slug: str) -> None:
    """Pre-race pipeline: fetch the race startlist + stage profiles (Spec A A7)."""
    from browser_session import BrowserSession
    from sync import get_supabase
    from sync_race import import_startlist, import_stage_profiles

    supabase = get_supabase()
    race_name, race_date_val = race_meta(race_slug)

    print(f"=== Pipeline C: startlists ===")
    print(f"Race : {race_name}")
    print(f"Slug : {race_slug}")
    print(f"Date : {race_date_val or '(not in calendar)'}")
    print()

    async with BrowserSession() as browser:
        context, page = await new_browser_page(browser)
        try:
            print("--- Importing startlist ---")
            result = await import_startlist(
                supabase,
                page,
                race_slug=race_slug,
                race_name=race_name,
                race_date=race_date_val,
            )
            print(json.dumps(result, indent=2))

            print()
            print("--- Importing stage profiles ---")
            profiles = await import_stage_profiles(
                supabase,
                page,
                race_slug=race_slug,
                race_name=race_name,
            )
            print(json.dumps(profiles, indent=2))
        finally:
            await context.close()

    print()
    print("Done — startlists + stage profiles complete.")
```

- [ ] **Step 2: Smoke-check the file parses**

Run: `cd services/pcs-sync && .venv/bin/python -c "import run_pipeline"`
Expected: no output (clean import).

Run: `cd services/pcs-sync && .venv/bin/python -m pytest -q`
Expected: `191 passed` (no test imports run_pipeline; the smoke check above is the contract).

- [ ] **Step 3: Commit**

```bash
git add services/pcs-sync/run_pipeline.py
git commit -m "feat(pipeline): run_startlists also seeds stage_profiles (Spec A A7)"
```

---

## Task 4: `place_tactic` v2 — Nemesis profile gating

Add a profile lookup + validation block to `place_tactic`. The rest of the function (cutoff, GT phase check, same-league + ≥-XP) is untouched. Use `CREATE OR REPLACE FUNCTION` so the rollback can restore the previous body.

**Files:**
- Create: `supabase/migrations/20260603000100_place_tactic_profile_gating.sql`
- Create: `supabase/migrations/_rollback/20260603000100_place_tactic_profile_gating.down.sql` (verbatim copy of `20260510100000_place_tactic_cutoff_check.sql`'s `CREATE OR REPLACE` block)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260603000100_place_tactic_profile_gating.sql`:

```sql
-- Spec A (A7) — Nemesis profile gating at activation.
-- Nemesis Sprint: stage profile must be in {p1, p2, p3} (flat + hilly).
-- Nemesis GC:     stage profile must be in {p3, p4, p5} (hilly uphill + mountain).
-- A missing profile (stage not yet seeded in stage_profiles) → reject — players
-- must run `run_pipeline.py startlists` for the race before placing a Nemesis.

CREATE OR REPLACE FUNCTION place_tactic(
  p_team_id      UUID,
  p_phase_id     INT,
  p_year         INT,
  p_tactic_type  TEXT,
  p_stage_slug   TEXT,
  p_nemesis_target_team_id UUID DEFAULT NULL,
  p_nemesis_target_role    TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id     UUID;
  v_owner       UUID;
  v_my_league   UUID;
  v_target_league UUID;
  v_attacker_xp NUMERIC;
  v_target_xp   NUMERIC;
  v_gt_slug_pattern TEXT;
  v_role_filter TEXT;
  v_new_id      UUID;
  v_stage_date  DATE;
  v_stage_profile TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Ownership check
  SELECT user_id, league_id INTO v_owner, v_my_league
  FROM teams WHERE id = p_team_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'team not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_owner != v_user_id THEN
    RAISE EXCEPTION 'not team owner' USING ERRCODE = '42501';
  END IF;

  -- Tactic-type validity
  IF p_tactic_type NOT IN
       ('unleash','overdrive','call_the_bus','nemesis_gc','nemesis_sprint') THEN
    RAISE EXCEPTION 'invalid tactic_type %', p_tactic_type
      USING ERRCODE = 'check_violation';
  END IF;

  -- Phase validity (must be a GT phase: 4=Giro, 6=Tour, 8=Vuelta)
  IF p_phase_id NOT IN (4, 6, 8) THEN
    RAISE EXCEPTION 'phase % is not a GT phase', p_phase_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- GT slug pattern for the phase
  v_gt_slug_pattern := CASE p_phase_id
    WHEN 4 THEN 'race/giro-d-italia/' || p_year || '/%'
    WHEN 6 THEN 'race/tour-de-france/' || p_year || '/%'
    WHEN 8 THEN 'race/vuelta-a-espana/' || p_year || '/%'
  END;

  -- Stage_slug must belong to this GT phase
  IF p_stage_slug NOT LIKE v_gt_slug_pattern THEN
    RAISE EXCEPTION 'stage_slug % does not belong to phase %', p_stage_slug, p_phase_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- 11:00 CET cutoff
  SELECT race_date INTO v_stage_date
  FROM race_startlists
  WHERE race_slug = p_stage_slug
  LIMIT 1;

  IF v_stage_date IS NOT NULL
     AND v_stage_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')::DATE
     AND (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')::TIME >= TIME '11:00' THEN
    RAISE EXCEPTION 'tactic cutoff has passed for today stage'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Nemesis-specific validations
  IF p_tactic_type IN ('nemesis_gc','nemesis_sprint') THEN
    IF p_nemesis_target_team_id IS NULL OR p_nemesis_target_role IS NULL THEN
      RAISE EXCEPTION 'nemesis tactics require a target team and role';
    END IF;

    -- Profile gating (Spec A A7) — REQUIRES stage_profiles seeded for this stage_slug.
    SELECT profile_icon INTO v_stage_profile
    FROM stage_profiles
    WHERE race_slug = p_stage_slug
    LIMIT 1;

    IF v_stage_profile IS NULL THEN
      RAISE EXCEPTION 'stage profile unknown for % — run the startlists pipeline first', p_stage_slug
        USING ERRCODE = 'check_violation';
    END IF;

    IF p_tactic_type = 'nemesis_sprint'
       AND v_stage_profile NOT IN ('p1','p2','p3') THEN
      RAISE EXCEPTION 'Nemesis Sprint requires a flat or hilly stage (p1/p2/p3), got %', v_stage_profile
        USING ERRCODE = 'check_violation';
    END IF;

    IF p_tactic_type = 'nemesis_gc'
       AND v_stage_profile NOT IN ('p3','p4','p5') THEN
      RAISE EXCEPTION 'Nemesis GC requires a hilly-uphill or mountain stage (p3/p4/p5), got %', v_stage_profile
        USING ERRCODE = 'check_violation';
    END IF;

    -- Target must be in same league
    SELECT league_id INTO v_target_league FROM teams WHERE id = p_nemesis_target_team_id;
    IF v_target_league IS NULL THEN
      RAISE EXCEPTION 'target team not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_target_league != v_my_league THEN
      RAISE EXCEPTION 'target team not in same league' USING ERRCODE = '42501';
    END IF;

    -- ≥-XP eligibility (unchanged)
    v_role_filter := CASE p_tactic_type
      WHEN 'nemesis_gc' THEN 'gc_leader'
      ELSE 'sprinter'
    END;

    SELECT COALESCE(SUM(rxd.xp_gained), 0) INTO v_attacker_xp
    FROM gt_role_assignments ra
    JOIN rider_xp_daily rxd ON rxd.team_id = ra.team_id AND rxd.rider_id = ra.rider_id
    WHERE ra.team_id = p_team_id
      AND ra.phase_id = p_phase_id
      AND ra.year = p_year
      AND ra.role = v_role_filter
      AND rxd.race_slug LIKE v_gt_slug_pattern
      AND ra.applied_at = (
        SELECT MAX(applied_at) FROM gt_role_assignments
        WHERE team_id = ra.team_id AND rider_id = ra.rider_id
          AND phase_id = ra.phase_id AND year = ra.year
      );

    SELECT COALESCE(SUM(rxd.xp_gained), 0) INTO v_target_xp
    FROM gt_role_assignments ra
    JOIN rider_xp_daily rxd ON rxd.team_id = ra.team_id AND rxd.rider_id = ra.rider_id
    WHERE ra.team_id = p_nemesis_target_team_id
      AND ra.phase_id = p_phase_id
      AND ra.year = p_year
      AND ra.role = v_role_filter
      AND rxd.race_slug LIKE v_gt_slug_pattern
      AND ra.applied_at = (
        SELECT MAX(applied_at) FROM gt_role_assignments
        WHERE team_id = ra.team_id AND rider_id = ra.rider_id
          AND phase_id = ra.phase_id AND year = ra.year
      );

    IF v_target_xp < v_attacker_xp THEN
      RAISE EXCEPTION 'target must have >= your GT XP (you=%, target=%)',
        v_attacker_xp, v_target_xp;
    END IF;
  ELSE
    -- Non-nemesis: nemesis fields must be NULL
    IF p_nemesis_target_team_id IS NOT NULL OR p_nemesis_target_role IS NOT NULL THEN
      RAISE EXCEPTION 'nemesis fields must be NULL for non-nemesis tactics';
    END IF;
  END IF;

  -- Insert
  INSERT INTO gt_tactic_activations(
    team_id, phase_id, year, tactic_type, stage_slug,
    nemesis_target_team_id, nemesis_target_role
  )
  VALUES (
    p_team_id, p_phase_id, p_year, p_tactic_type, p_stage_slug,
    p_nemesis_target_team_id, p_nemesis_target_role
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION place_tactic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_tactic TO authenticated;

COMMENT ON FUNCTION place_tactic IS
  'Validate + insert a GT tactic activation. SECURITY DEFINER. Adds Nemesis profile gating (Spec A A7): Nemesis Sprint requires stage profile p1/p2/p3, Nemesis GC requires p3/p4/p5. Reads stage_profiles seeded by run_pipeline.py startlists.';
```

- [ ] **Step 2: Write the rollback**

Create `supabase/migrations/_rollback/20260603000100_place_tactic_profile_gating.down.sql` — paste the **entire** body of `supabase/migrations/20260510100000_place_tactic_cutoff_check.sql` (the previous `CREATE OR REPLACE FUNCTION place_tactic` + REVOKE/GRANT/COMMENT). This restores the pre-P3a behavior.

```sql
-- Restore the pre-P3a place_tactic (cutoff check only, no profile gating).
-- Paste the verbatim contents of supabase/migrations/20260510100000_place_tactic_cutoff_check.sql here.
```

Open `supabase/migrations/20260510100000_place_tactic_cutoff_check.sql`, copy lines 4-168 (the `CREATE OR REPLACE FUNCTION` through the `COMMENT ON FUNCTION`), and paste them under the comment. Save.

- [ ] **Step 3: Apply locally**

Run: `supabase db reset`
Expected: all migrations run cleanly through `20260603000100`.

- [ ] **Step 4: Manual integration check (psql) — Nemesis profile gating**

Manually exercise the gating with one stage seeded. The goal is to confirm the four branches (sprint-on-flat OK, sprint-on-mountain blocked, gc-on-mountain OK, gc-on-flat blocked) plus the "unknown profile" branch.

Pre-requisite: at least one league + team + GT contract + GC role assignment seeded locally (`supabase db reset` reseeds the dev demo).

Run:
```bash
docker exec -i supabase_db_WattHunter psql -U postgres -d postgres <<'SQL'
-- Seed two profiles: a flat stage and a mountain stage of the Tour
INSERT INTO stage_profiles(race_slug, profile_icon, race_date)
VALUES
  ('race/tour-de-france/2026/stage-1',  'p1', '2026-07-04'),
  ('race/tour-de-france/2026/stage-12', 'p5', '2026-07-16'),
  ('race/tour-de-france/2026/stage-99', 'p3', '2026-07-26')
ON CONFLICT (race_slug) DO UPDATE
  SET profile_icon = EXCLUDED.profile_icon,
      race_date    = EXCLUDED.race_date;

-- Show what's there
SELECT race_slug, profile_icon FROM stage_profiles ORDER BY race_slug;
SQL
```

Then in the local web app or with `supabase functions invoke` / a `select` wrapper, attempt each Nemesis combination. (Skip if the agent does not have a logged-in session locally — the unit-level guarantees come from the migration itself; the psql round-trip above confirms the table + RPC parse without errors.)

- [ ] **Step 5: Push to prod (REQUIRES USER CONFIRMATION)**

⚠️ Per CLAUDE.md, ask the user before running. The migration replaces an existing function — additive in behavior (a new validation branch); existing tactics keep working.

Run (only after the user confirms): `supabase db push --linked`

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260603000100_place_tactic_profile_gating.sql supabase/migrations/_rollback/20260603000100_place_tactic_profile_gating.down.sql
git commit -m "feat(rpc): place_tactic gates Nemesis by stage profile (Spec A A7)"
```

---

## Task 5: Seed `stage_profiles` for the rest of 2026

The RPC change is harmless without data — a `nemesis_*` tactic on an unseeded stage simply errors with "stage profile unknown". This task seeds the table for the races still to come this season.

Source list (forward-only — Giro already complete):
- `race/tour-de-france/2026`
- `race/criterium-du-dauphine/2026` (if present in `wt_calendar_2026.json`)
- `race/tour-de-suisse/2026`
- `race/tour-de-pologne/2026`
- `race/vuelta-a-espana/2026`
- any remaining 1-week races flagged `"type": "stage-race"` in `wt_calendar_2026.json` with `start_date >= today`.

**Files:** none (data only).

- [ ] **Step 1: Enumerate remaining stage-races**

Run: `cd services/pcs-sync && .venv/bin/python -c "
import json, datetime
today = datetime.date.today().isoformat()
data = json.load(open('wt_calendar_2026.json'))
for r in data:
    if r.get('type') == 'stage-race' and (r.get('start_date') or '') >= today:
        print(r['slug'])
"`
Expected: one slug per line for upcoming stage-races.

- [ ] **Step 2: Seed each race**

For each printed slug, run (locally, with your residential IP — Cloudflare blocks datacenter IPs):

```bash
cd services/pcs-sync
.venv/bin/python run_pipeline.py startlists --race "<slug>"
```

The pipeline now also seeds `stage_profiles` (Task 3). Check the JSON summary printed at the end — `imported` should equal the stage count.

- [ ] **Step 3: Verify in prod**

Run: `cd services/pcs-sync && .venv/bin/python -c "
from sync import get_supabase
sb = get_supabase()
rows = sb.table('stage_profiles').select('race_slug, profile_icon').execute().data
print(f'{len(rows)} stage_profiles rows total')
for r in rows[:5]: print(r)
"`
Expected: at least ~21 rows (Tour de France) + the others, with realistic profile_icon distribution (mix of p1-p5).

- [ ] **Step 4: No commit** (data-only step). Note the seeded races in the chat / handoff.

---

## Task 6: Documentation

**Files:**
- Modify: `docs/GAME_RULES.md` (§11 — add the constants; §13 — Nemesis profile gating block)
- Modify: `docs/ARCHITECTURE.md` (Tables list + RPC section)

- [ ] **Step 1: Update `docs/GAME_RULES.md` §11 (Game Constants)**

Add under §11 the two constants:

```markdown
### Tactic gating profiles (Spec A A7)
- `NEMESIS_SPRINT_PROFILES = {p1, p2, p3}` (flat + hilly — anything but mountain).
- `NEMESIS_GC_PROFILES     = {p3, p4, p5}` (hilly-uphill + mountain — where the GC is decided).
- Source : `supabase/migrations/20260603000100_place_tactic_profile_gating.sql`.
```

- [ ] **Step 2: Update `docs/GAME_RULES.md` §13 (Tactics)**

Add at the end of the §13 Nemesis subsection:

```markdown
**Profile gating at activation (Spec A A7).** A Nemesis tactic can only be placed on a stage whose profile matches the duel type:
- Nemesis Sprint → stage profile must be in {p1, p2, p3}.
- Nemesis GC     → stage profile must be in {p3, p4, p5}.

The profile comes from `stage_profiles` (one row per stage_slug), seeded ahead of the race by `python run_pipeline.py startlists --race "<race_slug>"`. If the stage isn't seeded yet, placement returns "stage profile unknown".
```

- [ ] **Step 3: Update `docs/ARCHITECTURE.md`**

Under the Tables section, add:
```markdown
- **`stage_profiles`** — `race_slug PK, profile_icon (p0-p5), race_date`. Pre-race source of `profile_icon` for `place_tactic` Nemesis gating. Populated by `services/pcs-sync/sync_race.py:import_stage_profiles` via the startlists pipeline.
```

Under the RPC section (or `place_tactic` entry), add a one-liner:
```markdown
- **`place_tactic`** — v2 (2026-06-02): Nemesis Sprint requires profile p1/p2/p3, Nemesis GC requires p3/p4/p5 (looked up in `stage_profiles`).
```

- [ ] **Step 4: Commit**

```bash
git add docs/GAME_RULES.md docs/ARCHITECTURE.md
git commit -m "docs: Nemesis profile gating + stage_profiles (Spec A A7)"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full pcs-sync suite**

Run: `cd services/pcs-sync && .venv/bin/python -m pytest -q`
Expected: `191 passed`.

- [ ] **Step 2: TypeScript build / type check**

Run: `cd apps/web && pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Smoke check the local stack**

Visit `/league/<demo>/team/gt/tactics` in the local web app, attempt a Nemesis placement on a seeded stage of wrong profile, expect the new error string to surface (the existing TS wrapper forwards `error.message` directly).

- [ ] **Step 4: Hand off to finishing-a-development-branch**

Per superpowers, complete the branch via `superpowers:finishing-a-development-branch` (PR vs merge decision is the user's).

---

## Open / known limitations

- **One-day races** : not gated (Monuments don't take a Nemesis — the existing GT-phase check already blocks them).
- **Profile not yet seeded** : `place_tactic` rejects the Nemesis with "stage profile unknown". This is intentional — better a hard error than silently allowing a tactic that the spec says shouldn't fire. Operationally, run `startlists` early.
- **`Stage.profile_icon()` vs `Race.stages()[].profile_icon`** : both surface the same icon. Tests mock `Race.stages()` directly; production reads `Race(...).stages()` once per race. If PCS revises a profile after seeding, re-running `startlists` updates the row (ON CONFLICT path).
