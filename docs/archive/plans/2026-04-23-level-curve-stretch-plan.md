# Level Curve Stretch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Mechanism 3 of the Anti-Runaway System — stretch the XP thresholds for Lv.6-8 (900→1200, 1500→1800, 2000→2400) and remap sponsor unlocks (T4 moves to Lv.4, T5 to Lv.6) while grandfathering existing levels (no player regresses).

**Architecture:** Two sources of truth — `apps/web/lib/levels.ts` (client/server TypeScript config) and `services/pcs-sync/scoring.py` `LEVEL_THRESHOLDS` constant. Both must be updated atomically. The scoring pipeline is patched so `team.level` can only monotonically increase (never regress) when the new thresholds are applied. No DB migration required since levels are config-driven; only `teams.level` values stay intact via the monotonic guard.

**Tech Stack:**
- TypeScript (`apps/web/lib/levels.ts`) — client-side level display
- Python (`services/pcs-sync/scoring.py`) — server-side level computation
- vitest + pytest for unit tests

---

## Prerequisites

- Design spec reviewed: `docs/plans/2026-04-23-anti-runaway-system-design.md` §5
- Remontada Boost plan (plan 1 of 3) can run in parallel — no file conflicts
- Co-Unlock Rule plan (plan 2 of 3) can run in parallel — no file conflicts
- Python env set up, Next.js dev server can start

## File Structure

**Modified files (2):**
- `apps/web/lib/levels.ts` — XP thresholds (Lv.6-8) + sponsor field remap
- `services/pcs-sync/scoring.py` — `LEVEL_THRESHOLDS` array + monotonic level guard at line ~410

**New test files (2):**
- `apps/web/lib/levels.test.ts` — if it doesn't already exist, unit tests for the new thresholds
- `services/pcs-sync/tests/test_scoring_levels.py` — test `compute_level` + non-regression

## Conventions

- TS tests run from `apps/web/` with `pnpm test`
- Python tests run from `services/pcs-sync/` with `pytest -v`
- Both `LEVEL_THRESHOLDS` arrays must stay in sync — update in the same commit

---

## Task 1: Update the TypeScript LEVELS config

**Files:**
- Modify: `apps/web/lib/levels.ts`

- [ ] **Step 1: Apply the new XP thresholds and sponsor remap**

Replace the `LEVELS` array (lines 1-10) with:

```typescript
export const LEVELS = [
  { level: 1, xp: 0,    slots: 6,  pool: "#300-600", poolMin: 300, strategy: "Speciality",  maxActive: 1, sponsor: "Lotto · 250K" },
  { level: 2, xp: 25,   slots: 7,  pool: "#200-600", poolMin: 200, strategy: null,          maxActive: 1, sponsor: "Astana · 350K" },
  { level: 3, xp: 150,  slots: 8,  pool: "#100-600", poolMin: 100, strategy: "Nationality", maxActive: 2, sponsor: "T3 · 450K (×4)" },
  { level: 4, xp: 350,  slots: 9,  pool: "#30-600",  poolMin: 30,  strategy: null,          maxActive: 2, sponsor: "T4 · 650K (×4)" },
  { level: 5, xp: 600,  slots: 10, pool: "#20-600",  poolMin: 20,  strategy: "Teams",       maxActive: 2, sponsor: null },
  { level: 6, xp: 1200, slots: 11, pool: "#10-600",  poolMin: 10,  strategy: null,          maxActive: 2, sponsor: "T5 · 1M (×2)" },
  { level: 7, xp: 1800, slots: 12, pool: "#4-600",   poolMin: 4,   strategy: "Age",         maxActive: 3, sponsor: null },
  { level: 8, xp: 2400, slots: 12, pool: "#1-600",   poolMin: 1,   strategy: null,          maxActive: 3, sponsor: "T6 UAE · 1.25M" },
] as const;
```

**Changes vs current:**
- Lv.4 `sponsor`: `null` → `"T4 · 650K (×4)"` (T4 now unlocks here, one level earlier)
- Lv.5 `sponsor`: `"T4 · 650K (×4)"` → `null` (T4 is inherited from Lv.4)
- Lv.6 `xp`: `900` → `1200`, `sponsor`: `null` → `"T5 · 1M (×2)"` (T5 now unlocks here)
- Lv.7 `xp`: `1500` → `1800`, `sponsor`: `"T5 · 1M (×2)"` → `null` (T5 is inherited from Lv.6)
- Lv.8 `xp`: `2000` → `2400` (sponsor unchanged)

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: no new type errors (the `LEVELS as const` shape is unchanged — same keys, same types).

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/levels.ts
git commit -m "feat(levels): stretch Lv.6-8 XP thresholds + remap T4@Lv.4, T5@Lv.6"
```

---

## Task 2: Update the Python LEVEL_THRESHOLDS

**Files:**
- Modify: `services/pcs-sync/scoring.py:21`

- [ ] **Step 1: Update the constant**

In `services/pcs-sync/scoring.py`, replace line 21:

```python
# Level thresholds — must match apps/web/lib/levels.ts (8 levels)
LEVEL_THRESHOLDS = [0, 25, 150, 350, 600, 1200, 1800, 2400]
```

The array must stay synced with the `xp` values in `apps/web/lib/levels.ts`. If the TS file is ever re-ordered or a level is added, mirror it here.

- [ ] **Step 2: Run the existing scoring tests to check for regressions**

Run: `cd services/pcs-sync && pytest tests/test_scoring.py -v`
Expected: all existing tests pass. If any test asserts a specific level from a specific XP that uses old thresholds (e.g., "500 XP → Lv.4"), update the test expectation to match the new table.

- [ ] **Step 3: Commit**

```bash
git add services/pcs-sync/scoring.py
git commit -m "feat(scoring): match new Lv.6-8 thresholds from levels.ts"
```

---

## Task 3: Add the monotonic level guard (no regression)

**Files:**
- Modify: `services/pcs-sync/scoring.py` (the team update block around line 404-414)

- [ ] **Step 1: Write a failing test for the grandfather behavior**

Create `services/pcs-sync/tests/test_scoring_levels.py`:

```python
"""Tests that the Level Curve Stretch grandfathers existing team levels:
a team currently at Lv.6 with 900 XP (below the new 1200 threshold) must stay Lv.6."""
from unittest.mock import MagicMock, patch

def _team_row(level: int, xp: float):
    row = MagicMock()
    row.data = {"id": "team-1", "cumulative_xp": xp, "level": level, "league_id": "lg-1"}
    return row

def test_no_level_regression_when_xp_below_new_threshold():
    """Team at Lv.6 with 900 XP stays Lv.6 after scoring, even though 900 < 1200 (new Lv.6 threshold)."""
    from scoring import compute_level, LEVEL_THRESHOLDS

    # Sanity check new thresholds are loaded.
    assert LEVEL_THRESHOLDS[5] == 1200, "Lv.6 threshold should be 1200"

    # compute_level returns the "mathematical" level for an XP value.
    assert compute_level(900) == 5  # 900 is between Lv.5 (600) and Lv.6 (1200) → Lv.5

    # BUT the grandfather rule says: if current_level > computed_level, keep current_level.
    current_level = 6
    computed = compute_level(900)
    effective = max(current_level, computed)
    assert effective == 6  # grandfathered

def test_level_up_still_works_after_stretch():
    """Team at Lv.5 with 1200 XP moves to Lv.6 under new thresholds."""
    from scoring import compute_level
    assert compute_level(1200) == 6

    current_level = 5
    computed = compute_level(1200)
    effective = max(current_level, computed)
    assert effective == 6  # leveled up correctly
```

- [ ] **Step 2: Run to verify the computational assertions pass**

Run: `cd services/pcs-sync && pytest tests/test_scoring_levels.py -v`
Expected: both pass (they test helper logic only, not scoring wiring).

- [ ] **Step 3: Patch scoring.py to use the monotonic guard**

In `services/pcs-sync/scoring.py`, around lines 404-414, replace:

```python
            # Task 3: auto level-up
            current_level = team_row.data.get("level", 1)
            new_level = compute_level(new_xp)

            update_data: dict = {
                "cumulative_xp": new_xp,
            }
            if new_level != current_level:
                update_data["level"] = new_level
                logger.info(f"Team {team_id} level up: {current_level} → {new_level} (XP: {new_xp})")
```

With:

```python
            # Task 3: auto level-up (monotonic — no regression, per Level Curve Stretch grandfather rule)
            current_level = team_row.data.get("level", 1)
            computed_level = compute_level(new_xp)
            new_level = max(current_level, computed_level)  # grandfather: never regress

            update_data: dict = {
                "cumulative_xp": new_xp,
            }
            if new_level > current_level:
                update_data["level"] = new_level
                logger.info(f"Team {team_id} level up: {current_level} → {new_level} (XP: {new_xp})")
            elif computed_level < current_level:
                logger.debug(
                    f"Team {team_id} grandfathered at Lv.{current_level} (computed would be Lv.{computed_level} with {new_xp} XP)"
                )
```

- [ ] **Step 4: Run the full Python test suite**

Run: `cd services/pcs-sync && pytest -v`
Expected: all pass. The grandfather path is a no-op for fresh teams (current_level=1 always equals computed) and preserves existing levels for pre-stretch teams.

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/scoring.py services/pcs-sync/tests/test_scoring_levels.py
git commit -m "feat(scoring): monotonic level guard to grandfather existing levels"
```

---

## Task 4: Verify the UI reads team.level from DB, not computed from XP

**Files:** none modified in this task — this is an audit step.

- [ ] **Step 1: Search for any UI code that displays a computed level from XP**

Run:
```bash
grep -rn "getLevelForXp" apps/web/ --include="*.tsx" --include="*.ts"
```

Expected output: any hits should be in `lib/levels.ts` itself (the definition) or in admin-only / read-only contexts. Any hit that displays `getLevelForXp(team.cumulative_xp)` as the team's visible level is a bug for the grandfather rule — it would show the "computed" level, which might be below the grandfathered DB level.

- [ ] **Step 2: Spot-check the team level display**

Read `apps/web/components/team-level-card.tsx` and confirm the displayed level is read from `team.level` (a prop / DB field) not `getLevelForXp(team.cumulative_xp)`.

If any file displays a computed level, change it to read the DB `level` field. The progress bar (`getProgressPct`) is fine to compute from XP — only the *level number* display must read the DB.

- [ ] **Step 3: No commit needed if audit finds no issues**

If changes were made, commit with:

```bash
git add apps/web/components/
git commit -m "fix(web): read team.level from DB for grandfather compliance"
```

---

## Task 5: Update unlock descriptions and level guide copy

**Files:**
- Modify: `apps/web/lib/levels.ts` — `getNewUnlocks` and `getUnlockDescriptions` should now produce correct strings given the remap

- [ ] **Step 1: Verify getNewUnlocks output is correct for all levels**

The existing `getNewUnlocks` function (lines 43-69) already compares `current.sponsor` vs `prev.sponsor`. With the new LEVELS array:
- Lv.4 has `sponsor: "T4 · 650K (×4)"` (non-null) → pill appears at Lv.4 ✓
- Lv.5 has `sponsor: null` → no sponsor pill ✓ (Lv.5 reuses T4 from Lv.4)
- Lv.6 has `sponsor: "T5 · 1M (×2)"` → pill appears at Lv.6 ✓
- Lv.7 has `sponsor: null` → no sponsor pill ✓

No code change needed; the function behaves correctly with the new data.

- [ ] **Step 2: Verify getUnlockDescriptions output matches**

Same logic — `getUnlockDescriptions` (lines 85-113) surfaces the sponsor when `current.sponsor` is truthy. No code change needed.

- [ ] **Step 3: Run any existing tests for levels.ts**

Run: `cd apps/web && pnpm test -- levels 2>&1 | tail -20`
Expected: tests pass if they exist; if no test file exists, skip to step 4.

- [ ] **Step 4: No commit — audit only**

---

## Task 6: Add a smoke-test script to assert both sources of truth agree

**Files:**
- Create: `apps/web/lib/levels-sync-check.test.ts` (vitest)

- [ ] **Step 1: Write the sync test**

```typescript
// apps/web/lib/levels-sync-check.test.ts
// Guards against drift between TS LEVELS and Python LEVEL_THRESHOLDS.
// If this test fails, one of the two sources was updated without the other.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LEVELS } from "./levels";

describe("LEVELS vs Python LEVEL_THRESHOLDS", () => {
  it("xp values in levels.ts match LEVEL_THRESHOLDS in scoring.py", () => {
    const tsXps = LEVELS.map((l) => l.xp);

    // Resolve scoring.py path relative to this test file.
    const scoringPath = join(
      __dirname,
      "../../../services/pcs-sync/scoring.py",
    );
    const py = readFileSync(scoringPath, "utf-8");
    const match = py.match(/LEVEL_THRESHOLDS\s*=\s*\[([\d\s,]+)\]/);
    expect(match).not.toBeNull();
    const pyXps = match![1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number);

    expect(pyXps).toEqual(tsXps);
  });
});
```

- [ ] **Step 2: Run the test to verify sync is clean now**

Run: `cd apps/web && pnpm test -- levels-sync`
Expected: PASS (both sources agree after Tasks 1 and 2).

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/levels-sync-check.test.ts
git commit -m "test(levels): guard against TS/Python LEVEL_THRESHOLDS drift"
```

---

## Task 7: Manual smoke test

**Files:** none (operational task)

- [ ] **Step 1: Check an existing team's level display**

Run: `cd apps/web && pnpm dev`
Log in as any existing user. Navigate to Team page → verify the displayed level matches `teams.level` in DB (not the new "computed from XP" value).

- [ ] **Step 2: Check the progress bar**

On the same page, the XP progress bar should show the team's XP / next-level threshold using the NEW thresholds.

Example: team at Lv.5 with 780 XP → bar shows `780/1200` toward Lv.6 (previously would have shown `780/900`).

- [ ] **Step 3: Check the levels guide**

Navigate to `/league/<id>/levels`. Verify:
- Lv.4 lists "T4 · 650K (×4)" as a new unlock
- Lv.6 lists "T5 · 1M (×2)" as a new unlock
- XP thresholds match 0 / 25 / 150 / 350 / 600 / 1200 / 1800 / 2400

- [ ] **Step 4: Run Pipeline B to simulate a scoring run**

```bash
cd services/pcs-sync
python3 run_pipeline.py post-race --race "race/paris-nice/2026/stage-3"
```

Check logs: grandfathered teams should log "grandfathered at Lv.X" if applicable. No team should lose a level.

---

## Known gaps / follow-up work

Documented for the next iteration (not blocking):

1. **Retroactive re-picking of sponsor** — existing teams at Lv.4 who previously didn't have T4 access won't automatically get T4. They need to manually re-select a sponsor (or we add a one-off migration script). Not required for MVP: current sponsor choices remain valid.
2. **Sponsors Rework spec reconciliation** — the "Sponsors Rework" spec in MEMORY.md defines 13 sponsors with specific amounts. This plan uses the current sponsor labels from `levels.ts`. When Sponsors Rework lands, re-sync the sponsor labels here.
3. **`getDefaultStartingLevel` date ranges** — the function at `levels.ts:71-83` maps calendar dates to starting levels. If the stretched curve means Lv.6+ is rarely reached, adjust the calendar mapping downward. Out of scope for this plan.

---

## Handoff to execution

Plan complete and saved to `docs/plans/2026-04-23-level-curve-stretch-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks.
2. **Inline Execution** — execute tasks in this session with checkpoints.

Which approach?
