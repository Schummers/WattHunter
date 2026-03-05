# Top 500 & Level Gating Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 9 ProTeam rider pool with the top 500 PCS global ranking, gated by team level (L1=#401-500, L10=#1-10).

**Architecture:** (1) Migration to add `ever_in_top500` column + update XP thresholds, (2) Replace `sync_all_riders()`/`init-riders` with a `sync_top500()` function that scrapes 5 pages, (3) Update `update_global_ranking()` to 5 pages, (4) Update auction UI to filter by level+rank instead of team_type.

**Tech Stack:** Supabase Postgres migrations, Python (sync.py, sync_race.py, run_pipeline.py), Next.js TypeScript (page.tsx, actions.ts)

**Design doc:** `docs/plans/2026-03-05-top500-level-gating-design.md`

---

### Task 1: Supabase Migration — `ever_in_top500` + XP thresholds

**Files:**
- Create: `supabase/migrations/20260305200000_top500_level_gating.sql`

**Step 1: Write the migration**

```sql
-- Top 500 & Level Gating (2026-03-05-top500-level-gating-design.md)

-- 1. Add ever_in_top500 flag to riders
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS ever_in_top500 boolean NOT NULL DEFAULT false;

-- 2. Mark all existing riders with pcs_rank <= 500 as ever_in_top500
UPDATE public.riders SET ever_in_top500 = true WHERE pcs_rank IS NOT NULL AND pcs_rank <= 500;

-- 3. Mark all existing riders with pcs_points_1yr > 0 as ever_in_top500
-- (they were already verified from the PCS ranking)
UPDATE public.riders SET ever_in_top500 = true WHERE pcs_points_1yr > 0;
```

**Step 2: Apply migration**

Run: `supabase db push`
Expected: Migration applied successfully.

**Step 3: Commit**

```bash
git add supabase/migrations/20260305200000_top500_level_gating.sql
git commit -m "migration: add ever_in_top500 column to riders"
```

---

### Task 2: Create `sync_top500()` — replace ProTeam roster sync

**Files:**
- Modify: `services/pcs-sync/sync.py` (replace `sync_all_riders()` with `sync_top500()`)
- Create: `services/pcs-sync/tests/test_sync_top500.py`

**Step 1: Write the failing test**

Create `services/pcs-sync/tests/test_sync_top500.py`:

```python
"""Tests for sync_top500 — scrapes PCS global ranking and upserts riders."""
from __future__ import annotations

from unittest.mock import MagicMock, AsyncMock, patch
import pytest


def test_rank_max_for_level():
    """Level thresholds: L1=500, L5=150, L10=10."""
    from sync import rank_max_for_level

    assert rank_max_for_level(1) == 500
    assert rank_max_for_level(2) == 400
    assert rank_max_for_level(3) == 300
    assert rank_max_for_level(4) == 200
    assert rank_max_for_level(5) == 150
    assert rank_max_for_level(6) == 100
    assert rank_max_for_level(7) == 75
    assert rank_max_for_level(8) == 50
    assert rank_max_for_level(9) == 25
    assert rank_max_for_level(10) == 10


def test_format_rider_name():
    """PCS names: 'DE KLEIJN Arvid' → 'Arvid De Kleijn'."""
    from sync import format_rider_name

    assert format_rider_name("POGAČAR Tadej") == "Tadej Pogačar"
    assert format_rider_name("DE KLEIJN Arvid") == "Arvid De Kleijn"
    assert format_rider_name("VAN DER HOORN Taco") == "Taco Van Der Hoorn"
    assert format_rider_name("Unknown") == "Unknown"
```

**Step 2: Run tests to verify they fail**

Run: `cd services/pcs-sync && python3 -m pytest tests/test_sync_top500.py -v`
Expected: FAIL — `rank_max_for_level` not found.

**Step 3: Implement in sync.py**

Add to `services/pcs-sync/sync.py` (after imports, before `get_supabase()`):

```python
# Level gating thresholds: level → max PCS rank accessible
LEVEL_RANK_THRESHOLDS = [500, 400, 300, 200, 150, 100, 75, 50, 25, 10]


def rank_max_for_level(level: int) -> int:
    """Return the max PCS rank a player at this level can access."""
    idx = max(0, min(level, 10) - 1)
    return LEVEL_RANK_THRESHOLDS[idx]


def format_rider_name(raw_name: str) -> str:
    """Convert PCS format 'DE KLEIJN Arvid' → 'Arvid De Kleijn'."""
    words = raw_name.split()
    i = 0
    while i < len(words) and words[i] == words[i].upper() and len(words[i]) > 1:
        i += 1
    if 0 < i < len(words):
        first_parts = words[i:]
        last_parts = [w.title() for w in words[:i]]
        return " ".join(first_parts) + " " + " ".join(last_parts)
    return raw_name
```

Now add the `sync_top500()` function. Replace the existing `sync_all_riders()` function (lines 149-203) with:

```python
async def sync_top500(supabase: Optional[Client] = None, pages: int = 5) -> dict:
    """
    Scrape the PCS global individual ranking (top N×100) and upsert riders.

    This replaces sync_all_riders() — the game pool is the top 500 PCS global,
    not specific ProTeam rosters.

    Uses fresh browser context per page to avoid Cloudflare.
    Page 1 uses clean URL; pages 2+ use rankings.php with offset & filter params.
    """
    from playwright.async_api import async_playwright
    from procyclingstats import Ranking

    if supabase is None:
        supabase = get_supabase()

    results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        for page_idx in range(pages):
            offset = page_idx * 100
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            )
            page = await context.new_page()

            try:
                if offset == 0:
                    fetch_url = "https://www.procyclingstats.com/rankings/me/individual"
                else:
                    fetch_url = (
                        "https://www.procyclingstats.com/rankings.php"
                        "?p=me&s=individual&offset={}&filter=Filter".format(offset)
                    )

                await asyncio.sleep(4)
                await page.goto(fetch_url, wait_until="domcontentloaded")
                await page.wait_for_timeout(6000)

                html = await page.content()
                if any(m in html for m in ["Just a moment", "Checking your browser"]):
                    logger.warning("Cloudflare blocked at offset=%d", offset)
                    break

                ranking = Ranking("rankings/me/individual", html=html, update_html=False)
                entries = ranking.individual_ranking()

                synced = 0
                errors = []

                for entry in entries:
                    try:
                        slug = entry.get("rider_url", "")
                        if not slug:
                            continue

                        name = format_rider_name(entry.get("rider_name", "Unknown"))
                        team_name = entry.get("team_name", "Unknown")
                        nationality = entry.get("nationality", "??")[:2].upper()
                        pcs_points = entry.get("points", 0) or 0
                        pcs_rank = entry.get("rank")
                        salary = calculate_monthly_salary(pcs_points)

                        rider_data = {
                            "pcs_slug": slug,
                            "full_name": name,
                            "nationality": nationality,
                            "real_team": team_name,
                            "pcs_points_1yr": pcs_points,
                            "pcs_rank": pcs_rank,
                            "monthly_salary": salary,
                            "ever_in_top500": True,
                            "last_synced_at": datetime.utcnow().isoformat(),
                        }

                        supabase.table("riders").upsert(
                            rider_data, on_conflict="pcs_slug"
                        ).execute()
                        synced += 1

                    except Exception as e:
                        logger.error("Failed to sync rider %s: %s", slug, e)
                        errors.append(str(e))

                results.append({
                    "offset": offset,
                    "synced": synced,
                    "total_on_page": len(entries),
                    "errors": errors,
                })

            finally:
                await context.close()

            if page_idx < pages - 1:
                pause = 15
                print("    Waiting {}s before next page...".format(pause))
                await asyncio.sleep(pause)

        await browser.close()

    total_synced = sum(r["synced"] for r in results)
    total_errors = sum(len(r["errors"]) for r in results)
    return {
        "status": "completed",
        "total_synced": total_synced,
        "total_errors": total_errors,
        "pages": results,
    }
```

Also keep `sync_all_riders()` but mark it as deprecated (or remove it entirely — the plan removes it).

**Step 4: Run tests**

Run: `cd services/pcs-sync && python3 -m pytest tests/test_sync_top500.py -v`
Expected: All pass.

**Step 5: Commit**

```bash
git add services/pcs-sync/sync.py services/pcs-sync/tests/test_sync_top500.py
git commit -m "feat: sync_top500() — scrape PCS global ranking instead of ProTeam rosters"
```

---

### Task 3: Update `update_global_ranking()` to 5 pages

**Files:**
- Modify: `services/pcs-sync/sync_race.py:101` (change `pages: int = 3` to `pages: int = 5`)
- Modify: `services/pcs-sync/run_pipeline.py` (update Pipeline B to use `pages=5`)

**Step 1: Change default pages to 5**

In `services/pcs-sync/sync_race.py`, line 101, change:

```python
async def update_global_ranking(supabase: Client, browser, *, pages: int = 3) -> Dict[str, Any]:
```

To:

```python
async def update_global_ranking(supabase: Client, browser, *, pages: int = 5) -> Dict[str, Any]:
```

Also update the `ever_in_top500` flag during ranking updates. After the `supabase.table("riders").update(...)` call (around line 166), add:

```python
                    # Also mark as ever_in_top500 if ranked
                    if pcs_rank and pcs_rank <= 500:
                        supabase.table("riders").update(
                            {"ever_in_top500": True}
                        ).eq("id", rider_id).execute()
```

**Step 2: Update Pipeline B caller**

In `services/pcs-sync/run_pipeline.py`, update the ranking step text:

Change:
```python
            print("--- Updating global PCS ranking (top 500) ---")
            ranking_result = await update_global_ranking(supabase, browser, pages=3)
```

To:
```python
            print("--- Updating global PCS ranking (top 500) ---")
            ranking_result = await update_global_ranking(supabase, browser, pages=5)
```

**Step 3: Run tests**

Run: `cd services/pcs-sync && python3 -m pytest tests/ -v`
Expected: All pass.

**Step 4: Commit**

```bash
git add services/pcs-sync/sync_race.py services/pcs-sync/run_pipeline.py
git commit -m "feat: update_global_ranking to 5 pages (top 500)"
```

---

### Task 4: Replace Pipeline A `init-riders` with top 500 sync

**Files:**
- Modify: `services/pcs-sync/run_pipeline.py:98-140` (replace `run_init_riders()`)

**Step 1: Replace `run_init_riders()`**

Replace the entire `run_init_riders()` function (lines 98-140) with:

```python
async def run_init_riders() -> None:
    """Annual initialization: sync top 500 PCS riders + import season rankings."""
    from playwright.async_api import async_playwright
    from sync import get_supabase, sync_top500
    from sync_race import import_season_rankings

    supabase = get_supabase()

    print("=== Pipeline A: init-riders ===")
    print()

    # Step 1: sync top 500 PCS global ranking
    print("--- Step 1/2: Sync top 500 PCS riders ---")
    result = await sync_top500(supabase, pages=5)
    print(json.dumps(result, indent=2))

    # Step 2: season rankings — fresh context per season to avoid Cloudflare
    print()
    print("--- Step 2/2: Import season rankings (2024, 2025, 2026) ---")
    seasons = [2024, 2025, 2026]
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            for i, season in enumerate(seasons):
                context = await browser.new_context(user_agent=USER_AGENT)
                page = await context.new_page()
                print("  Season {}...".format(season))
                result = await import_season_rankings(
                    supabase, page, seasons=[season]
                )
                print("    Upserted: {}, errors: {}".format(
                    result['total_upserted'], len(result['errors'])
                ))
                if result["errors"]:
                    for err in result["errors"][:3]:
                        print("    ERROR: {}".format(err))
                await context.close()
                if i < len(seasons) - 1:
                    print("    Waiting 15s before next season...")
                    await asyncio.sleep(15)
        finally:
            await browser.close()

    print()
    print("Done — init-riders complete.")
```

**Step 2: Update docstring**

Update the module docstring at the top of `run_pipeline.py`:

```python
"""
WattHunter PCS Sync CLI — run locally (residential IP required).
Cloudflare blocks datacenter IPs; GitHub Actions cannot be used for scraping.

Requires:
  - .env file in this directory (see .env.example)
  - Playwright Chromium installed: python3 -m playwright install chromium
  - Residential IP (Cloudflare blocks datacenter IPs)

Usage:
  cd services/pcs-sync

  # Pipeline A — sync top 500 PCS riders + season rankings
  python3 run_pipeline.py init-riders

  # Pipeline B — after each race/stage finishes
  python3 run_pipeline.py post-race --race "race/strade-bianche/2026"

  # Pipeline C — before auctions/races open
  python3 run_pipeline.py startlists --race "race/tour-de-france/2026"

  # Pipeline D — monthly finance (sponsor + salaries + bankruptcy)
  python3 run_pipeline.py monthly-finance
"""
```

**Step 3: Run tests**

Run: `cd services/pcs-sync && python3 -m pytest tests/ -v`
Expected: All pass.

**Step 4: Commit**

```bash
git add services/pcs-sync/run_pipeline.py
git commit -m "feat: Pipeline A now syncs top 500 PCS instead of 9 ProTeam rosters"
```

---

### Task 5: Update auction UI — filter by level + rank

**Files:**
- Modify: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/page.tsx:37`
- Modify: `apps/web/app/(game)/league/[leagueId]/auctions/[auctionId]/actions.ts:57-70`

**Step 1: Add `rankMaxForLevel` helper**

Create or add to a shared file. For simplicity, add directly in `page.tsx` before the component:

```typescript
function rankMaxForLevel(level: number): number {
  const thresholds = [500, 400, 300, 200, 150, 100, 75, 50, 25, 10];
  return thresholds[Math.min(Math.max(level, 1), 10) - 1];
}
```

**Step 2: Update rider query in page.tsx**

Replace line 37:
```typescript
.eq("team_type", "ProTeam")
```

With:
```typescript
.eq("ever_in_top500", true)
.lte("pcs_rank", rankMaxForLevel(team.level))
```

Note: this requires the `team.level` to be available in the page. Check that the team query already selects `level`. If not, add it to the team select.

**Step 3: Update bid validation in actions.ts**

Add the same `rankMaxForLevel` function to `actions.ts` and add a level check before accepting a bid:

```typescript
function rankMaxForLevel(level: number): number {
  const thresholds = [500, 400, 300, 200, 150, 100, 75, 50, 25, 10];
  return thresholds[Math.min(Math.max(level, 1), 10) - 1];
}
```

Add after the existing budget validation (after line 70):

```typescript
// Level gating: verify rider is accessible at team's level
const { data: rider } = await supabase
  .from("riders")
  .select("pcs_rank, ever_in_top500")
  .eq("id", parsed.data.riderId)
  .single();

if (!rider?.ever_in_top500) {
  return { error: "Ce coureur n'est pas dans le pool jouable" };
}

if (rider.pcs_rank && rider.pcs_rank > rankMaxForLevel(team.level)) {
  return { error: "Niveau insuffisant pour ce coureur" };
}
```

**Step 4: Run typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: No errors.

**Step 5: Commit**

```bash
git add apps/web/app/\(game\)/league/\[leagueId\]/auctions/\[auctionId\]/page.tsx
git add apps/web/app/\(game\)/league/\[leagueId\]/auctions/\[auctionId\]/actions.ts
git commit -m "feat: auction UI filters riders by level + PCS rank"
```

---

### Task 6: Update XP thresholds in GAME_RULES.md

**Files:**
- Modify: `docs/GAME_RULES.md:188-206`

**Step 1: Update XP thresholds**

In section 7.2, replace the existing XP table with:

| Level | XP cumulé | Slots | Politiques | Rang PCS débloqué |
|---|---|---|---|---|
| 1 | 0 | 6 | 0 | #401-500 |
| 2 | 1 000 | 6 | 0 | #301-500 |
| 3 | 3 000 | 7 | 1 | #201-500 |
| 4 | 6 000 | 7 | 1 | #151-500 |
| 5 | 10 000 | 8 | 1 | #101-500 |
| 6 | 18 000 | 9 | 2 | #76-500 |
| 7 | 30 000 | 10 | 2 | #51-500 |
| 8 | 50 000 | 10 | 2 | #26-500 |
| 9 | 80 000 | 11 | 2 | #11-500 |
| 10 | 120 000 | 12 | 3 | #1-500 |

Replace the rider access section to remove ProTeam references:
- Remove "L1: ProTeam only (~383 riders)"
- Replace with: "L1: PCS rank #401-500 (100 riders)"
- Remove all references to ProTeam/WorldTour distinction

**Step 2: Update CLAUDE.md**

Update the constants section to reflect:
- Pool: Top 500 PCS global (not 9 ProTeams)
- Pipeline A: `python3 run_pipeline.py init-riders` — syncs top 500 PCS riders
- XP thresholds: Level 5 = 10K, Level 10 = 120K
- Remove `PROTEAM_SLUGS` reference

**Step 3: Commit**

```bash
git add docs/GAME_RULES.md CLAUDE.md
git commit -m "docs: update GAME_RULES + CLAUDE.md for top 500 + level gating"
```

---

### Task 7: Clean up — remove old ProTeam code

**Files:**
- Modify: `services/pcs-sync/sync.py` (remove `PROTEAM_SLUGS`, `sync_team_roster()`, `sync_all_riders()`)

**Step 1: Remove dead code**

In `services/pcs-sync/sync.py`:
- Remove `PROTEAM_SLUGS` list (lines 26-36)
- Remove `SPECIALTY_MAP` (lines 38-45) — not used anymore
- Remove `sync_team_roster()` function
- Remove `sync_all_riders()` function
- Keep: `get_supabase()`, `calculate_monthly_salary()`, `fetch_html()`, `rank_max_for_level()`, `format_rider_name()`, `sync_top500()`

**Step 2: Run tests**

Run: `cd services/pcs-sync && python3 -m pytest tests/ -v`
Expected: All pass (no test references the removed functions).

**Step 3: Commit**

```bash
git add services/pcs-sync/sync.py
git commit -m "refactor: remove ProTeam roster sync code (replaced by top 500)"
```

---

### Task 8: Seed top 500 — run initial sync

**Files:** None (runtime task)

**Step 1: Run the new Pipeline A**

Run: `cd services/pcs-sync && python3 run_pipeline.py init-riders`
Expected: ~500 riders synced from 5 pages of PCS ranking.

**Step 2: Verify data**

```python
python3 -c "
from dotenv import load_dotenv; load_dotenv()
from sync import get_supabase
sb = get_supabase()
total = sb.table('riders').select('id', count='exact').eq('ever_in_top500', True).execute()
print(f'Top 500 riders in DB: {total.count}')
top = sb.table('riders').select('full_name, pcs_rank, pcs_points_1yr').order('pcs_rank').limit(5).execute()
for r in top.data: print(f'  #{r[\"pcs_rank\"]} {r[\"full_name\"]} ({r[\"pcs_points_1yr\"]} pts)')
"
```

Expected: ~500 riders, #1 = Pogačar.

**Step 3: Clean up old riders**

Remove riders that are NOT in the top 500 (old ProTeam riders that didn't make the cut):

```python
python3 -c "
from dotenv import load_dotenv; load_dotenv()
from sync import get_supabase
sb = get_supabase()
result = sb.table('riders').delete().eq('ever_in_top500', False).execute()
print(f'Removed {len(result.data)} riders not in top 500')
"
```

**Step 4: Commit (no code changes, just verify)**

No commit needed — this is a runtime data task.

---

## Task Dependency Graph

```
Task 1 (migration) ──→ Task 2 (sync_top500)
                   ──→ Task 3 (ranking 5 pages)
                   ──→ Task 5 (auction UI)
Task 2 ──→ Task 4 (Pipeline A)
Task 4 ──→ Task 7 (cleanup)
Task 7 ──→ Task 8 (seed data)
Task 6 (docs) — independent, do anytime
```

Tasks 2, 3, 5, 6 can run in parallel after Task 1.

---

## How to verify everything works

1. Apply migration: `supabase db push`
2. Run tests: `cd services/pcs-sync && python3 -m pytest tests/ -v`
3. Run Pipeline A: `python3 run_pipeline.py init-riders` → 500 riders synced
4. Check riders: top 500 PCS global, with Pogačar at #1
5. Check auction UI: only riders matching team level are shown
6. Run `pnpm typecheck` and `pnpm lint` in apps/web
