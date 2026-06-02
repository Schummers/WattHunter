# Spec C — Bonus Economy & Sponsors (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-result + goals sponsor economy with the 2-value barème (1-week base / ×2 for Grand Tour & Monument), reduce T4/T5 base, rework goals per archetype, extend goal evaluation to 1-week stage races, and grandfather the already-paid Giro.

**Architecture:** The "2-value" system stores only the **A** (1-week) value in DB/code; the **B** value (Grand Tour / Monument) is `A × 2` computed at runtime. `sponsor_bonus.py` is unified (one path for T1–T5, legacy path kept only for T6/deferred). Goals live in `apps/web/lib/gt-goals.ts` (source of truth) mirrored by `goal_evaluator.py`; goal evaluation is extended from GT-only to all stage races (`_is_squad_race`), paying ×2 for GTs (`_is_gt_slug`). The Giro is grandfathered via an operational cutover (stage results = old barème, final classifications = new) plus a reconciliation/audit step — no claw-back of paid bonuses.

**Tech Stack:** Python 3.12 (`services/pcs-sync/.venv/bin/python`), pytest, Supabase Postgres migrations (`supabase db push --linked`), TypeScript (`apps/web`), vitest.

---

## Locked decisions (from Spec C, 2026-06-02/03)

- 2-value everywhere; **B = 2 × A** at runtime (no new DB columns).
- Base bonus per tier (A value · threshold): T1 GC 5k/25, Stage 2.5k/10, One-day 5k/25 · T2 10k/20, 5k/10, 10k/20 · T3 25k/15, 10k/5, 20k/15 · **T4 10k/10, 5k/3, 10k/10** · **T5 = T4** (drop prestige) · **T6 unchanged (deferred)**.
- Nationality **×1.20** for **T1–T4** only; none for T5–T6.
- Goals (T4+): archetype menu (GC / Sprint / CLM / Stage-Hunter), **best-of within a tier group per rider**, profile-gated sprinter stage wins (p1/p2/p3).
- Goal→sponsor sets: Ineos GC+CLM · Decathlon GC+Sprint · Soudal/Lidl Sprint+StageHunter · Visma GC+Sprint · RedBull GC+StageHunter.
- Maillot leader goal = **"Race Leader"** (generic). Youth + KOM goals tracked.
- **Goals extended to 1-week stage races** (×1; GT ×2). Monuments have no goals (no squad).
- Giro = **Grandfather** (Option 1): stage results (incl. stage 21) + their stage goals = OLD barème; final classifications (GC/points/KOM/youth) = NEW barème; reconciliation + audit; no claw-back.
- `orientation` column **kept** in this plan (dropped later in the UI plan; front `getOrientationTags` still uses it).

## Assumptions for execution

- All work in an isolated git worktree off `main` (see superpowers:using-git-worktrees). Worktree env: `ln -s /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync/.venv services/pcs-sync/.venv && cp -R /Users/jonathanschummers/Documents/WattHunter/supabase/.temp supabase/.temp`.
- `supabase db push --linked` requires **explicit user confirmation** (prod DB). Migrations ship with a `_rollback` counterpart.
- Run pytest from `services/pcs-sync`: `.venv/bin/python -m pytest <path> -v`.

---

## File Structure

**Phase 1 — Base bonus**
- Create: `supabase/migrations/20260603120000_sponsors_two_value_bareme.sql` — UPDATE T1–T5 amounts/thresholds, reset T5 prestige.
- Create: `supabase/migrations/20260603120000_sponsors_two_value_bareme_rollback.sql` — restore prior live values.
- Modify: `services/pcs-sync/sponsor_bonus.py` — unify `calculate_bonus` (A × ×2 × nat 1.20).
- Test: `services/pcs-sync/tests/test_sponsor_bonus.py` — new 2-value cases.

**Phase 2 — Goals economy + 1-week**
- Modify: `apps/web/lib/gt-goals.ts` — archetype goal-sets, new amounts, `tierGroup`, Race Leader / youth / KOM goals.
- Test: `apps/web/lib/gt-goals.test.ts` — structure assertions.
- Modify: `services/pcs-sync/goal_evaluator.py` — mirror goals, ×2 for GT, new evaluators (`eval_win_kom_classification`, fixed `eval_wear_youth_jersey`, finals from `gt_final_classifications`), sprinter profile gating, `tierGroup` suppression, 1-week extension entry point.
- Test: `services/pcs-sync/tests/test_goal_evaluator.py` — evaluator + multiplier + gating + 1-week cases.
- Modify: `services/pcs-sync/run_pipeline.py` — call goal evaluation for 1-week stage races (not only GTs).

**Phase 3 — Giro cutover + reconciliation**
- Create: `services/pcs-sync/reconcile_bonuses.py` — read-only reconciliation report + double-count guard.
- Test: `services/pcs-sync/tests/test_reconcile_bonuses.py`.
- Create: `docs/runbooks/2026-06-03-giro-cutover.md` — operational sequence.

---

## Phase 1 — Base Bonus

### Task 1: Migration — sponsors 2-value barème + rollback

**Files:**
- Create: `supabase/migrations/20260603120000_sponsors_two_value_bareme.sql`
- Create: `supabase/migrations/20260603120000_sponsors_two_value_bareme_rollback.sql`

- [ ] **Step 1: Write the forward migration**

```sql
-- Spec C — 2-value barème. Store only the A (1-week) value; B (GT/Monument) = 2×A
-- is applied at runtime in sponsor_bonus.py. T1-T3 reaffirmed (live already matches),
-- T4 reduced, T5 = T4 with prestige folded into runtime ×2. T6 (UAE) deferred — untouched.

-- T1-T3: reaffirm target A values + thresholds (idempotent)
UPDATE public.sponsors SET bonus_gc = 5000,  bonus_stage = 2500,  bonus_one_day = 5000,
  gc_threshold = 25, stage_threshold = 10, one_day_threshold = 25 WHERE tier = 1;
UPDATE public.sponsors SET bonus_gc = 10000, bonus_stage = 5000,  bonus_one_day = 10000,
  gc_threshold = 20, stage_threshold = 10, one_day_threshold = 20 WHERE tier = 2;
UPDATE public.sponsors SET bonus_gc = 25000, bonus_stage = 10000, bonus_one_day = 20000,
  gc_threshold = 15, stage_threshold = 5,  one_day_threshold = 15 WHERE tier = 3;

-- T4: reduced base (GC 50k→10k, Stage 20k→5k, One-day 25k→10k); thresholds unchanged
UPDATE public.sponsors SET bonus_gc = 10000, bonus_stage = 5000,  bonus_one_day = 10000,
  gc_threshold = 10, stage_threshold = 3,  one_day_threshold = 10 WHERE tier = 4;

-- T5: identical to T4; drop explicit prestige (runtime ×2 replaces it)
UPDATE public.sponsors SET bonus_gc = 10000, bonus_stage = 5000,  bonus_one_day = 10000,
  gc_threshold = 10, stage_threshold = 3,  one_day_threshold = 10,
  has_explicit_prestige = false,
  bonus_monument = NULL, bonus_grand_tour = NULL,
  monument_threshold = NULL, grand_tour_threshold = NULL WHERE tier = 5;

-- T6 (UAE): intentionally untouched (deferred).
```

- [ ] **Step 2: Write the rollback migration** (restores prior live values per sponsor)

```sql
-- Rollback for 20260603120000_sponsors_two_value_bareme.sql
-- Restores the pre-Spec-C live values captured 2026-06-02.

-- T1-T3 (unchanged values, restated for completeness)
UPDATE public.sponsors SET bonus_gc = 5000,  bonus_stage = 2500,  bonus_one_day = 5000,
  gc_threshold = 25, stage_threshold = 10, one_day_threshold = 25 WHERE tier = 1;
UPDATE public.sponsors SET bonus_gc = 10000, bonus_stage = 5000,  bonus_one_day = 10000,
  gc_threshold = 20, stage_threshold = 10, one_day_threshold = 20 WHERE tier = 2;
UPDATE public.sponsors SET bonus_gc = 25000, bonus_stage = 10000, bonus_one_day = 20000,
  gc_threshold = 15, stage_threshold = 5,  one_day_threshold = 15 WHERE tier = 3;

-- T4 prior live values
UPDATE public.sponsors SET bonus_gc = 50000, bonus_stage = 20000, bonus_one_day = 25000,
  gc_threshold = 10, stage_threshold = 3,  one_day_threshold = 10 WHERE tier = 4;

-- T5 prior live values (per sponsor — they differed)
UPDATE public.sponsors SET bonus_gc = 25000, bonus_stage = 15000, bonus_one_day = 25000,
  gc_threshold = 5, stage_threshold = 1, one_day_threshold = 5,
  has_explicit_prestige = true,
  bonus_monument = 75000, bonus_grand_tour = 75000,
  monument_threshold = 3, grand_tour_threshold = 3 WHERE slug = 'visma';
UPDATE public.sponsors SET bonus_gc = 30000, bonus_stage = 15000, bonus_one_day = 30000,
  gc_threshold = 5, stage_threshold = 1, one_day_threshold = 5,
  has_explicit_prestige = true,
  bonus_monument = 50000, bonus_grand_tour = 50000,
  monument_threshold = 5, grand_tour_threshold = 5 WHERE slug = 'redbull-bora';
```

- [ ] **Step 3: Validate SQL syntax locally** (do NOT push yet)

Run: `cd /Users/jonathanschummers/Documents/WattHunter && grep -c "UPDATE public.sponsors" supabase/migrations/20260603120000_sponsors_two_value_bareme.sql`
Expected: `6`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260603120000_sponsors_two_value_bareme.sql supabase/migrations/20260603120000_sponsors_two_value_bareme_rollback.sql
git commit -m "feat(sponsors): 2-value barème migration — T4/T5 reduced, T5 prestige folded"
```

> **NOTE:** `supabase db push --linked` is deferred to Phase 3 deployment (after code is ready), and requires explicit user confirmation.

---

### Task 2: Unify `calculate_bonus` — write failing test first

**Files:**
- Test: `services/pcs-sync/tests/test_sponsor_bonus.py`
- Modify: `services/pcs-sync/sponsor_bonus.py`

- [ ] **Step 1: Write the failing tests** (append to test file)

```python
# --- Spec C 2-value barème ---

def _t4_sponsor():
    # Decathlon (tier 4) post-migration values
    return {
        "id": "sp-dec", "tier": 4, "nationality": "FR",
        "bonus_gc": 10000, "gc_threshold": 10,
        "bonus_stage": 5000, "stage_threshold": 3,
        "bonus_one_day": 10000, "one_day_threshold": 10,
        "has_explicit_prestige": False,
    }


def test_t4_stage_one_week_is_A_value():
    from sponsor_bonus import calculate_bonus
    # 1-week stage race, rank 2 (<=3), no nationality → A value 5000, ×1
    base, mult, final = calculate_bonus(
        _t4_sponsor(), "stage", 2, None, "race/paris-nice/2026/stage-2")
    assert (base, mult, final) == (5000, 1.0, 5000)


def test_t4_stage_grand_tour_is_doubled():
    from sponsor_bonus import calculate_bonus
    # Grand Tour stage, rank 2 → ×2 → 10000
    base, mult, final = calculate_bonus(
        _t4_sponsor(), "stage", 2, None, "race/giro-d-italia/2026/stage-2")
    assert (base, mult, final) == (5000, 2.0, 10000)


def test_t4_monument_one_day_is_doubled():
    from sponsor_bonus import calculate_bonus
    # Monument (one-day) result, rank 5 (<=10) → one_day base 10000 × 2 = 20000
    base, mult, final = calculate_bonus(
        _t4_sponsor(), "monument", 5, None, "race/ronde-van-vlaanderen/2026/result")
    assert (base, mult, final) == (10000, 2.0, 20000)


def test_t4_nationality_is_1_20_not_1_25():
    from sponsor_bonus import calculate_bonus
    # FR rider matches Decathlon FR, GT stage → ×2 ×1.20 = 2.4 → 5000×2.4 = 12000
    base, mult, final = calculate_bonus(
        _t4_sponsor(), "stage", 1, "FR", "race/giro-d-italia/2026/stage-2")
    assert base == 5000
    assert abs(mult - 2.4) < 1e-9
    assert final == 12000


def test_t4_threshold_excludes_rank_beyond():
    from sponsor_bonus import calculate_bonus
    # stage threshold 3, rank 4 → no bonus
    assert calculate_bonus(_t4_sponsor(), "stage", 4, None,
                           "race/giro-d-italia/2026/stage-2") == (0, 0.0, 0)


def test_t5_has_no_nationality_bonus():
    from sponsor_bonus import calculate_bonus
    visma = {
        "id": "sp-vis", "tier": 5, "nationality": None,
        "bonus_gc": 10000, "gc_threshold": 10,
        "bonus_stage": 5000, "stage_threshold": 3,
        "bonus_one_day": 10000, "one_day_threshold": 10,
        "has_explicit_prestige": False,
    }
    base, mult, final = calculate_bonus(visma, "stage", 1, "NL",
                                        "race/giro-d-italia/2026/stage-2")
    assert (base, mult, final) == (5000, 2.0, 10000)  # ×2 only, no ×1.20
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && .venv/bin/python -m pytest tests/test_sponsor_bonus.py -k "t4 or t5" -v`
Expected: FAIL (current code applies ×1.25, has no ×2 for T4 stage in GT).

---

### Task 3: Implement unified `calculate_bonus`

**Files:**
- Modify: `services/pcs-sync/sponsor_bonus.py`

- [ ] **Step 1: Add the doubling helper** (near `_is_grand_tour_slug`, ~line 72)

```python
def _is_doubled(result_type: str, race_slug: str) -> bool:
    """B-value (×2) applies for Grand Tour stage/gc results and for monuments."""
    if result_type == "monument":
        return True
    if result_type == "grand_tour":
        return True
    if result_type in ("stage", "gc") and _is_grand_tour_slug(race_slug):
        return True
    return False
```

- [ ] **Step 2: Add the base/threshold resolver**

```python
def _base_and_threshold(sponsor: dict, result_type: str) -> tuple[Optional[int], Optional[int]]:
    """Map a result_type to the sponsor's A base amount + rank threshold."""
    if result_type in ("gc", "grand_tour"):
        return sponsor.get("bonus_gc"), sponsor.get("gc_threshold")
    if result_type in ("one_day", "monument"):
        return sponsor.get("bonus_one_day"), sponsor.get("one_day_threshold")
    if result_type == "stage":
        return sponsor.get("bonus_stage"), sponsor.get("stage_threshold")
    return None, None
```

- [ ] **Step 3: Replace `calculate_bonus` dispatch** (lines 77–95)

```python
def calculate_bonus(
    sponsor: dict,
    result_type: str,
    rank: int,
    rider_nationality: Optional[str],
    race_slug: str,
) -> tuple[int, float, int]:
    """Calculate sponsor bonus for a single race result (Spec C 2-value barème).

    A value from the sponsor row × 2 for Grand Tour/Monument × 1.20 for nationality
    match (T1-T4 only). T6 keeps the legacy prestige path (deferred rework).
    Returns (base, multiplier, final); (0, 0.0, 0) if rank doesn't qualify.
    """
    tier = sponsor.get("tier")
    if tier == 6:
        return _calculate_bonus_t5_t6(sponsor, result_type, rank, race_slug)

    base, threshold = _base_and_threshold(sponsor, result_type)
    if base is None or threshold is None or rank > threshold:
        return (0, 0.0, 0)

    multiplier = 2.0 if _is_doubled(result_type, race_slug) else 1.0

    if tier is not None and tier <= 4:
        sponsor_nat = sponsor.get("nationality")
        if sponsor_nat and rider_nationality:
            if rider_nationality in expand_sponsor_nationality(sponsor_nat):
                multiplier *= 1.20

    final = int(base * multiplier)
    return (base, multiplier, final)
```

- [ ] **Step 4: Keep `_calculate_bonus_t1_t4` deleted/unused** — remove the old `_calculate_bonus_t1_t4` function (lines 98–133) since the unified path replaces it. Leave `_calculate_bonus_t5_t6` (used by T6).

- [ ] **Step 5: Run the new tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/test_sponsor_bonus.py -k "t4 or t5" -v`
Expected: PASS (6 tests).

- [ ] **Step 6: Run the FULL sponsor_bonus suite to catch regressions**

Run: `.venv/bin/python -m pytest tests/test_sponsor_bonus.py -v`
Expected: All PASS. If legacy tests assert `×1.25` or the old `_calculate_bonus_t1_t4`, update them to the new barème (×1.20, runtime ×2) — they encode the OLD rules and must change.

- [ ] **Step 7: Commit**

```bash
git add services/pcs-sync/sponsor_bonus.py services/pcs-sync/tests/test_sponsor_bonus.py
git commit -m "feat(sponsor-bonus): unify barème — runtime ×2 GT/Monument + nationality ×1.20"
```

---

### Task 4: Update bonus description string (×1.20 traceability)

**Files:**
- Modify: `services/pcs-sync/sponsor_bonus.py` (the description built in `process_race_bonuses`, ~line 395)

- [ ] **Step 1: Verify the description still renders the multiplier** — the existing description format `"Sponsor bonus: {result_type} rank {rank} in {race_slug} (×{multiplier})"` now shows `×2.0` / `×2.4` etc. Update any test asserting `(×1.0)` for a GT stage to the new multiplier. Run:

Run: `.venv/bin/python -m pytest tests/test_sponsor_bonus.py -v`
Expected: PASS.

- [ ] **Step 2: Commit (if changed)**

```bash
git add -A && git commit -m "test(sponsor-bonus): align description assertions with 2-value multipliers"
```

---

## Phase 2 — Goals Economy + 1-Week Extension

### Task 5: Refactor `gt-goals.ts` tiering to `tierGroup` (composition-safe)

**Files:**
- Modify: `apps/web/lib/gt-goals.ts`
- Test: `apps/web/lib/gt-goals.test.ts`

- [ ] **Step 1: Write failing test** (create/append)

```typescript
import { describe, it, expect } from "vitest";
import { GT_GOALS } from "./gt-goals";

describe("GT_GOALS — Spec C archetype sets", () => {
  it("decathlon has GC + Sprint sets (8 goals)", () => {
    const set = GT_GOALS.find((g) => g.sponsorSlug === "decathlon");
    expect(set).toBeDefined();
    expect(set!.goals).toHaveLength(8);
    const labels = set!.goals.map((g) => g.label);
    expect(labels).toContain("Podium GC");
    expect(labels).toContain("Win the points classification");
  });

  it("uses tierGroup (string) not tieredWith (index)", () => {
    const podium = GT_GOALS
      .find((g) => g.sponsorSlug === "decathlon")!
      .goals.find((g) => g.label === "Podium GC");
    expect(podium!.tierGroup).toBe("gc_placement");
    expect((podium as Record<string, unknown>).tieredWith).toBeUndefined();
  });

  it("Race Leader and youth jersey goals carry role gc_leader", () => {
    const ineos = GT_GOALS.find((g) => g.sponsorSlug === "ineos")!;
    const leader = ineos.goals.find((g) => g.label === "Wear the Race Leader jersey");
    expect(leader!.role).toBe("gc_leader");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm --filter web test -- gt-goals`
Expected: FAIL.

- [ ] **Step 3: Rewrite `gt-goals.ts`**

```typescript
export type GtGoalCategory = "gc" | "sprint" | "tt" | "stage_hunter";

export interface GtGoal {
  label: string;
  reward: number; // A (1-week base) value; ×2 applied at eval for GT/Monument
  role: "gc_leader" | "sprinter" | "climber" | "tt_specialist" | "stage_hunter" | null;
  category: GtGoalCategory;
  tierGroup?: string; // goals sharing a tierGroup → only the highest reward pays (per rider)
}

export interface GtGoalSet {
  sponsorSlug: string;
  goals: GtGoal[];
}

const GC_GOALS: GtGoal[] = [
  { label: "Podium GC", reward: 30_000, role: "gc_leader", category: "gc", tierGroup: "gc_placement" },
  { label: "Top 5 GC", reward: 20_000, role: "gc_leader", category: "gc", tierGroup: "gc_placement" },
  { label: "Wear the Race Leader jersey", reward: 15_000, role: "gc_leader", category: "gc" },
  { label: "Wear the young rider jersey", reward: 10_000, role: "gc_leader", category: "gc" },
];

const SPRINT_GOALS: GtGoal[] = [
  { label: "Win the points classification", reward: 30_000, role: "sprinter", category: "sprint" },
  { label: "Win 2 stages", reward: 20_000, role: "sprinter", category: "sprint", tierGroup: "sprint_stages" },
  { label: "Win a stage", reward: 10_000, role: "sprinter", category: "sprint", tierGroup: "sprint_stages" },
  { label: "Wear the points jersey", reward: 10_000, role: "sprinter", category: "sprint" },
];

const CLM_GOALS: GtGoal[] = [
  { label: "Win an ITT", reward: 15_000, role: "tt_specialist", category: "tt" },
  { label: "2 riders in top 10 of an ITT", reward: 10_000, role: null, category: "tt" },
];

const STAGE_HUNTER_GOALS: GtGoal[] = [
  { label: "Win the KOM classification", reward: 20_000, role: "climber", category: "stage_hunter" },
  { label: "Win 2 stages", reward: 20_000, role: "stage_hunter", category: "stage_hunter", tierGroup: "sh_stages" },
  { label: "Win a stage", reward: 10_000, role: "stage_hunter", category: "stage_hunter", tierGroup: "sh_stages" },
  { label: "Wear the KOM jersey", reward: 10_000, role: "climber", category: "stage_hunter" },
];

export const GT_GOALS: GtGoalSet[] = [
  { sponsorSlug: "ineos", goals: [...GC_GOALS, ...CLM_GOALS] },
  { sponsorSlug: "decathlon", goals: [...GC_GOALS, ...SPRINT_GOALS] },
  { sponsorSlug: "soudal", goals: [...SPRINT_GOALS, ...STAGE_HUNTER_GOALS] },
  { sponsorSlug: "lidl-trek", goals: [...SPRINT_GOALS, ...STAGE_HUNTER_GOALS] },
  { sponsorSlug: "visma", goals: [...GC_GOALS, ...SPRINT_GOALS] },
  { sponsorSlug: "redbull-bora", goals: [...GC_GOALS, ...STAGE_HUNTER_GOALS] },
];
```

- [ ] **Step 4: Update consumers of `tieredWith`** — search and fix. Run:

Run: `cd /Users/jonathanschummers/Documents/WattHunter && grep -rn "tieredWith" apps/web`
Expected: only matches you then update to `tierGroup` semantics (the UI suppression logic — if any — must group by `tierGroup` and show only the highest, or show all with a note). If the UI doesn't yet consume tiering, no change needed.

- [ ] **Step 5: Run test to verify pass**

Run: `pnpm --filter web test -- gt-goals`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/gt-goals.ts apps/web/lib/gt-goals.test.ts
git commit -m "feat(gt-goals): archetype goal-sets, 2-value rewards, tierGroup, Race Leader/youth/KOM"
```

---

### Task 6: Mirror goals + GT ×2 multiplier in `goal_evaluator.py`

**Files:**
- Modify: `services/pcs-sync/goal_evaluator.py`
- Test: `services/pcs-sync/tests/test_goal_evaluator.py`

- [ ] **Step 1: Write failing test for ×2 reward on a GT**

```python
def test_gt_goal_reward_doubled_for_grand_tour():
    """A 'Win a stage' goal (base 10k) pays 20k in a Grand Tour, 10k in a 1-week race."""
    from goal_evaluator import gt_reward_multiplier
    assert gt_reward_multiplier("race/giro-d-italia/2026") == 2.0
    assert gt_reward_multiplier("race/paris-nice/2026") == 1.0
```

- [ ] **Step 2: Run to verify fail**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && .venv/bin/python -m pytest tests/test_goal_evaluator.py -k doubled -v`
Expected: FAIL (`gt_reward_multiplier` undefined).

- [ ] **Step 3: Add the multiplier helper + mirror the new goal table**

Add near the top of `goal_evaluator.py` (mirror of `gt-goals.ts`, kept in sync):

```python
# Mirror of apps/web/lib/gt-goals.ts (source of truth). Keep in sync.
GC_GOALS = [
    {"label": "Podium GC", "reward": 30000, "role": "gc_leader", "category": "gc",
     "tier_group": "gc_placement", "evaluator": "gc_podium"},
    {"label": "Top 5 GC", "reward": 20000, "role": "gc_leader", "category": "gc",
     "tier_group": "gc_placement", "evaluator": "gc_top5"},
    {"label": "Wear the Race Leader jersey", "reward": 15000, "role": "gc_leader",
     "category": "gc", "evaluator": "wear_gc_jersey"},
    {"label": "Wear the young rider jersey", "reward": 10000, "role": "gc_leader",
     "category": "gc", "evaluator": "wear_youth_jersey"},
]
SPRINT_GOALS = [
    {"label": "Win the points classification", "reward": 30000, "role": "sprinter",
     "category": "sprint", "evaluator": "win_points_classification"},
    {"label": "Win 2 stages", "reward": 20000, "role": "sprinter", "category": "sprint",
     "tier_group": "sprint_stages", "evaluator": "win_2_stages"},
    {"label": "Win a stage", "reward": 10000, "role": "sprinter", "category": "sprint",
     "tier_group": "sprint_stages", "evaluator": "win_stage"},
    {"label": "Wear the points jersey", "reward": 10000, "role": "sprinter",
     "category": "sprint", "evaluator": "wear_points_jersey"},
]
CLM_GOALS = [
    {"label": "Win an ITT", "reward": 15000, "role": "tt_specialist", "category": "tt",
     "evaluator": "win_itt"},
    {"label": "2 riders in top 10 of an ITT", "reward": 10000, "role": None,
     "category": "tt", "evaluator": "two_riders_itt_top10"},
]
STAGE_HUNTER_GOALS = [
    {"label": "Win the KOM classification", "reward": 20000, "role": "climber",
     "category": "stage_hunter", "evaluator": "win_kom_classification"},
    {"label": "Win 2 stages", "reward": 20000, "role": "stage_hunter",
     "category": "stage_hunter", "tier_group": "sh_stages", "evaluator": "win_2_stages"},
    {"label": "Win a stage", "reward": 10000, "role": "stage_hunter",
     "category": "stage_hunter", "tier_group": "sh_stages", "evaluator": "win_stage"},
    {"label": "Wear the KOM jersey", "reward": 10000, "role": "climber",
     "category": "stage_hunter", "evaluator": "wear_kom_jersey"},
]
SPONSOR_GOAL_SETS = {
    "ineos": GC_GOALS + CLM_GOALS,
    "decathlon": GC_GOALS + SPRINT_GOALS,
    "soudal": SPRINT_GOALS + STAGE_HUNTER_GOALS,
    "lidl-trek": SPRINT_GOALS + STAGE_HUNTER_GOALS,
    "visma": GC_GOALS + SPRINT_GOALS,
    "redbull-bora": GC_GOALS + STAGE_HUNTER_GOALS,
}


def gt_reward_multiplier(parent_slug: str) -> float:
    """Goals pay ×2 for Grand Tours, ×1 for 1-week stage races."""
    from scoring import _is_gt_slug
    return 2.0 if _is_gt_slug(parent_slug) else 1.0
```

> The evaluator dispatch must read `goal["evaluator"]` to find the function (replacing positional/`goal_index` coupling to the old per-sponsor arrays). `goal_index` is now the index within `SPONSOR_GOAL_SETS[slug]`.

- [ ] **Step 4: Apply the multiplier in the reward computation** — in `evaluate_gt_goals`, where `base_reward = goal["reward"]`, compute:

```python
base_reward = goal["reward"]
gt_mult = gt_reward_multiplier(gt_parent_slug)
reward_after_gt = int(base_reward * gt_mult)
# nationality applies on top (unchanged logic), final = reward_after_gt × nat_mult
final_reward = int(reward_after_gt * multiplier)  # `multiplier` = 1.0 or 1.20 (see Task 9)
```

Persist `base_reward` as `reward_after_gt` (so `sponsor_goal_completions.base_reward` reflects the GT-scaled value, consistent with how the old code stored the paid base).

- [ ] **Step 5: Run the ×2 test**

Run: `.venv/bin/python -m pytest tests/test_goal_evaluator.py -k doubled -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/pcs-sync/goal_evaluator.py services/pcs-sync/tests/test_goal_evaluator.py
git commit -m "feat(goal-eval): mirror Spec C goal-sets + GT ×2 reward multiplier"
```

---

### Task 7: `eval_win_points_classification` + `eval_win_kom_classification` read `gt_final_classifications`

**Files:**
- Modify: `services/pcs-sync/goal_evaluator.py`
- Test: `services/pcs-sync/tests/test_goal_evaluator.py`

- [ ] **Step 1: Write failing tests**

```python
def test_win_points_classification_reads_final_table():
    """Points-classification winner comes from gt_final_classifications, not daily."""
    from goal_evaluator import eval_win_points_classification
    ctx = {
        "final_classifications": {
            "points": [{"rider_id": "rid-1", "rank": 1}, {"rider_id": "rid-2", "rank": 2}],
        },
        "eligible_riders": {"rid-1"},
    }
    assert eval_win_points_classification(ctx) == {"rider_id": "rid-1", "stage_slug": None}


def test_win_kom_classification():
    from goal_evaluator import eval_win_kom_classification
    ctx = {
        "final_classifications": {"kom": [{"rider_id": "rid-9", "rank": 1}]},
        "eligible_riders": {"rid-9"},
    }
    assert eval_win_kom_classification(ctx) == {"rider_id": "rid-9", "stage_slug": None}


def test_win_kom_not_eligible_returns_none():
    from goal_evaluator import eval_win_kom_classification
    ctx = {"final_classifications": {"kom": [{"rider_id": "rid-9", "rank": 1}]},
           "eligible_riders": set()}
    assert eval_win_kom_classification(ctx) is None
```

- [ ] **Step 2: Run to verify fail**

Run: `.venv/bin/python -m pytest tests/test_goal_evaluator.py -k "classification" -v`
Expected: FAIL.

- [ ] **Step 3: Implement the two evaluators** (replace the old `eval_win_points_classification` that read daily/last-stage)

```python
def eval_win_points_classification(ctx: dict) -> Optional[dict]:
    """Eligible rider won the FINAL points classification (gt_final_classifications)."""
    finals = ctx["final_classifications"].get("points", [])
    eligible = ctx["eligible_riders"]
    for e in finals:
        if e["rank"] == 1 and e["rider_id"] in eligible:
            return {"rider_id": e["rider_id"], "stage_slug": None}
    return None


def eval_win_kom_classification(ctx: dict) -> Optional[dict]:
    """Eligible rider won the FINAL KOM classification (gt_final_classifications)."""
    finals = ctx["final_classifications"].get("kom", [])
    eligible = ctx["eligible_riders"]
    for e in finals:
        if e["rank"] == 1 and e["rider_id"] in eligible:
            return {"rider_id": e["rider_id"], "stage_slug": None}
    return None
```

- [ ] **Step 4: Build `ctx["final_classifications"]` in `evaluate_gt_goals`** — fetch from the dedicated table:

```python
# Final classifications (points/kom/youth) live in gt_final_classifications,
# keyed by "{parent}/{ctype}". Fetch winners for this race.
final_classifications: dict[str, list[dict]] = {"points": [], "kom": [], "youth": []}
for ctype in ("points", "kom", "youth"):
    rows = _fetch_all(lambda c=ctype: supabase.table("gt_final_classifications")
                      .select("rider_id, rank")
                      .eq("race_slug", f"{gt_parent_slug}/{c}"))
    final_classifications[ctype] = rows
```

- [ ] **Step 5: Run tests**

Run: `.venv/bin/python -m pytest tests/test_goal_evaluator.py -k "classification" -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/pcs-sync/goal_evaluator.py services/pcs-sync/tests/test_goal_evaluator.py
git commit -m "feat(goal-eval): points/KOM classification goals read gt_final_classifications"
```

---

### Task 8: Un-skip `eval_wear_youth_jersey` + add `eval_wear_kom_jersey`

**Files:**
- Modify: `services/pcs-sync/goal_evaluator.py`
- Test: `services/pcs-sync/tests/test_goal_evaluator.py`

- [ ] **Step 1: Write failing tests**

```python
def test_wear_youth_jersey_now_tracked():
    from goal_evaluator import eval_wear_youth_jersey
    ctx = {
        "classifications": {"race/giro-d-italia/2026/stage-3": [
            {"classification_type": "youth", "rank": 1, "rider_id": "rid-y"},
        ]},
        "eligible_riders_by_stage": {"race/giro-d-italia/2026/stage-3": {"rid-y"}},
    }
    assert eval_wear_youth_jersey(ctx) == {"rider_id": "rid-y",
                                           "stage_slug": "race/giro-d-italia/2026/stage-3"}


def test_wear_kom_jersey():
    from goal_evaluator import eval_wear_kom_jersey
    ctx = {
        "classifications": {"race/giro-d-italia/2026/stage-3": [
            {"classification_type": "kom", "rank": 1, "rider_id": "rid-k"},
        ]},
        "eligible_riders_by_stage": {"race/giro-d-italia/2026/stage-3": {"rid-k"}},
    }
    assert eval_wear_kom_jersey(ctx) == {"rider_id": "rid-k",
                                         "stage_slug": "race/giro-d-italia/2026/stage-3"}
```

- [ ] **Step 2: Run to verify fail**

Run: `.venv/bin/python -m pytest tests/test_goal_evaluator.py -k "wear_youth or wear_kom" -v`
Expected: FAIL.

- [ ] **Step 3: Replace the skip + add KOM (mirror `eval_wear_points_jersey`)**

```python
def eval_wear_youth_jersey(ctx: dict) -> Optional[dict]:
    """Eligible rider held youth (white jersey) rank 1 on at least one stage.
    Youth is now imported into gt_daily_classifications (Spec A)."""
    classif = ctx["classifications"]
    eligible = ctx["eligible_riders_by_stage"]
    for stage_slug, entries in classif.items():
        stage_eligible = eligible.get(stage_slug, set())
        for e in entries:
            if e["classification_type"] == "youth" and e["rank"] == 1 and e["rider_id"] in stage_eligible:
                return {"rider_id": e["rider_id"], "stage_slug": stage_slug}
    return None


def eval_wear_kom_jersey(ctx: dict) -> Optional[dict]:
    """Eligible rider held KOM rank 1 on at least one stage."""
    classif = ctx["classifications"]
    eligible = ctx["eligible_riders_by_stage"]
    for stage_slug, entries in classif.items():
        stage_eligible = eligible.get(stage_slug, set())
        for e in entries:
            if e["classification_type"] == "kom" and e["rank"] == 1 and e["rider_id"] in stage_eligible:
                return {"rider_id": e["rider_id"], "stage_slug": stage_slug}
    return None
```

Register both in the `EVALUATORS` dict: `"wear_youth_jersey": eval_wear_youth_jersey, "wear_kom_jersey": eval_wear_kom_jersey`.

- [ ] **Step 4: Run tests**

Run: `.venv/bin/python -m pytest tests/test_goal_evaluator.py -k "wear_youth or wear_kom" -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/goal_evaluator.py services/pcs-sync/tests/test_goal_evaluator.py
git commit -m "feat(goal-eval): track youth jersey (un-skip) + KOM jersey goal"
```

---

### Task 9: Sprinter stage-win profile gating (p1/p2/p3)

**Files:**
- Modify: `services/pcs-sync/goal_evaluator.py`
- Test: `services/pcs-sync/tests/test_goal_evaluator.py`

- [ ] **Step 1: Write failing tests**

```python
FLAT = "p1"
MOUNTAIN = "p5"

def test_sprinter_win_stage_gated_to_flat_profile():
    from goal_evaluator import eval_win_stage
    # sprinter role: a mountain-profile win does NOT count
    ctx = {
        "stage_wins": {"race/giro-d-italia/2026/stage-7": "rid-s"},
        "eligible_riders_by_stage": {"race/giro-d-italia/2026/stage-7": {"rid-s"}},
        "stage_profiles": {"race/giro-d-italia/2026/stage-7": MOUNTAIN},
        "role": "sprinter",
    }
    assert eval_win_stage(ctx) is None


def test_sprinter_win_stage_counts_on_flat():
    from goal_evaluator import eval_win_stage
    ctx = {
        "stage_wins": {"race/giro-d-italia/2026/stage-7": "rid-s"},
        "eligible_riders_by_stage": {"race/giro-d-italia/2026/stage-7": {"rid-s"}},
        "stage_profiles": {"race/giro-d-italia/2026/stage-7": FLAT},
        "role": "sprinter",
    }
    assert eval_win_stage(ctx) == {"rider_id": "rid-s",
                                   "stage_slug": "race/giro-d-italia/2026/stage-7"}


def test_stage_hunter_win_stage_not_gated():
    from goal_evaluator import eval_win_stage
    ctx = {
        "stage_wins": {"race/giro-d-italia/2026/stage-7": "rid-h"},
        "eligible_riders_by_stage": {"race/giro-d-italia/2026/stage-7": {"rid-h"}},
        "stage_profiles": {"race/giro-d-italia/2026/stage-7": MOUNTAIN},
        "role": "stage_hunter",
    }
    assert eval_win_stage(ctx) is not None
```

- [ ] **Step 2: Run to verify fail**

Run: `.venv/bin/python -m pytest tests/test_goal_evaluator.py -k "gated or flat or not_gated" -v`
Expected: FAIL.

- [ ] **Step 3: Add the gating helper + apply in `eval_win_stage` / `eval_win_2_stages`**

```python
FLAT_PROFILES = {"p1", "p2", "p3"}


def _stage_counts_for_role(ctx: dict, stage_slug: str) -> bool:
    """Sprinter stage-win goals only count on flat profiles (p1/p2/p3).
    Stage-hunter (and any other role) is not gated. Spec A Q14."""
    if ctx.get("role") != "sprinter":
        return True
    profile = (ctx.get("stage_profiles", {}) or {}).get(stage_slug)
    return profile in FLAT_PROFILES
```

Update `eval_win_stage` to skip non-qualifying stages:

```python
def eval_win_stage(ctx: dict) -> Optional[dict]:
    stage_wins = ctx["stage_wins"]
    eligible = ctx["eligible_riders_by_stage"]
    for stage_slug, winner_id in stage_wins.items():
        if winner_id in eligible.get(stage_slug, set()) and _stage_counts_for_role(ctx, stage_slug):
            return {"rider_id": winner_id, "stage_slug": stage_slug}
    return None
```

Update `eval_win_2_stages` similarly — only count stages where `_stage_counts_for_role(ctx, stage_slug)` is True.

- [ ] **Step 4: Build `ctx["stage_profiles"]` and `ctx["role"]`** — in `evaluate_gt_goals`, populate `stage_profiles` from `race_results` (the `profile_icon` per stage slug) and set `role` per goal evaluation (the archetype role of the goal being evaluated). Add to the per-stage results fetch the `profile_icon` field:

```python
stage_profiles: dict[str, str] = {}
for r in race_results_rows:
    if r.get("profile_icon"):
        stage_profiles[r["race_slug"]] = r["profile_icon"]
# ... ctx["stage_profiles"] = stage_profiles
# ... ctx["role"] = goal["role"]   (set per-goal in the eval loop)
```

- [ ] **Step 5: Run tests**

Run: `.venv/bin/python -m pytest tests/test_goal_evaluator.py -k "gated or flat or not_gated" -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/pcs-sync/goal_evaluator.py services/pcs-sync/tests/test_goal_evaluator.py
git commit -m "feat(goal-eval): sprinter stage-win profile gating (p1/p2/p3)"
```

---

### Task 10: `tierGroup` suppression (best-of per rider)

**Files:**
- Modify: `services/pcs-sync/goal_evaluator.py`
- Test: `services/pcs-sync/tests/test_goal_evaluator.py`

- [ ] **Step 1: Write failing test**

```python
def test_tier_group_keeps_only_highest_reward():
    """If both 'Podium GC' (30k) and 'Top 5 GC' (20k) complete for the SAME rider,
    only the higher (Podium) is paid."""
    from goal_evaluator import suppress_tier_group_duplicates
    completed = [
        {"goal_index": 0, "label": "Podium GC", "reward": 30000,
         "tier_group": "gc_placement", "rider_id": "rid-1"},
        {"goal_index": 1, "label": "Top 5 GC", "reward": 20000,
         "tier_group": "gc_placement", "rider_id": "rid-1"},
    ]
    kept = suppress_tier_group_duplicates(completed)
    assert [c["label"] for c in kept] == ["Podium GC"]


def test_tier_group_different_riders_both_paid():
    from goal_evaluator import suppress_tier_group_duplicates
    completed = [
        {"goal_index": 0, "label": "Podium GC", "reward": 30000,
         "tier_group": "gc_placement", "rider_id": "rid-1"},
        {"goal_index": 1, "label": "Top 5 GC", "reward": 20000,
         "tier_group": "gc_placement", "rider_id": "rid-2"},
    ]
    kept = suppress_tier_group_duplicates(completed)
    assert len(kept) == 2
```

- [ ] **Step 2: Run to verify fail**

Run: `.venv/bin/python -m pytest tests/test_goal_evaluator.py -k tier_group -v`
Expected: FAIL.

- [ ] **Step 3: Implement suppression**

```python
def suppress_tier_group_duplicates(completed: list[dict]) -> list[dict]:
    """Within a (tier_group, rider_id), keep only the highest-reward completion.
    Goals without a tier_group, or with rider_id None, are always kept."""
    best: dict[tuple, dict] = {}
    passthrough: list[dict] = []
    for c in completed:
        tg = c.get("tier_group")
        rid = c.get("rider_id")
        if not tg or rid is None:
            passthrough.append(c)
            continue
        key = (tg, rid)
        if key not in best or c["reward"] > best[key]["reward"]:
            best[key] = c
    return passthrough + list(best.values())
```

Call it on the per-(team,sponsor) completed list before writing `sponsor_goal_completions`.

- [ ] **Step 4: Run tests**

Run: `.venv/bin/python -m pytest tests/test_goal_evaluator.py -k tier_group -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/goal_evaluator.py services/pcs-sync/tests/test_goal_evaluator.py
git commit -m "feat(goal-eval): tierGroup best-of-per-rider suppression"
```

---

### Task 11: Extend goal evaluation to 1-week stage races

**Files:**
- Modify: `services/pcs-sync/goal_evaluator.py` (rename/generalize entry; keep `evaluate_gt_goals` as a thin wrapper)
- Modify: `services/pcs-sync/run_pipeline.py`
- Test: `services/pcs-sync/tests/test_goal_evaluator.py`

- [ ] **Step 1: Write failing test — 1-week race evaluates at ×1**

```python
@pytest.mark.asyncio
async def test_evaluate_goals_one_week_pays_base_not_doubled(monkeypatch):
    """A 1-week race (Paris-Nice) pays the base reward (×1), not ×2."""
    from goal_evaluator import evaluate_sponsor_goals
    # minimal: one squad rider (sprinter) wins a flat stage for a decathlon team
    # (full mock wiring mirrors existing evaluate_gt_goals tests)
    # assert sponsor_goal_completions base_reward == 10000 (Win a stage, ×1)
    ...
```

> Mirror the wiring of the existing `evaluate_gt_goals` integration test in this file (same mock-queue ordering). The key assertion: for `race/paris-nice/2026`, the "Win a stage" completion has `base_reward == 10000` (not 20000).

- [ ] **Step 2: Run to verify fail**

Run: `.venv/bin/python -m pytest tests/test_goal_evaluator.py -k one_week -v`
Expected: FAIL (`evaluate_sponsor_goals` undefined).

- [ ] **Step 3: Generalize the entry point**

```python
async def evaluate_sponsor_goals(supabase, parent_slug: str) -> dict:
    """Evaluate sponsor goals for any stage race (GT or 1-week).
    GT → rewards ×2; 1-week → ×1 (via gt_reward_multiplier). Monuments/one-day
    have no squad and are not evaluated."""
    from scoring import _is_squad_race
    if not _is_squad_race(parent_slug):
        return {"goals_completed": 0, "errors": [], "skipped": "not a stage race"}
    # ... existing body, using SPONSOR_GOAL_SETS[sponsor_slug] and gt_reward_multiplier(parent_slug)
    ...


async def evaluate_gt_goals(supabase, gt_parent_slug: str) -> dict:
    """Backwards-compatible alias."""
    return await evaluate_sponsor_goals(supabase, gt_parent_slug)
```

- [ ] **Step 4: Wire run_pipeline.py to evaluate 1-week stage races** — in the post-race block (lines 643–658), replace the GT-prefix gate with `_is_squad_race`:

```python
from scoring import _is_squad_race
parents = set()
for s in all_imported_slugs:
    m = re.match(r"^(race/[a-z0-9-]+/\d{4})", s)
    if m and _is_squad_race(m.group(1)):
        parents.add(m.group(1))
for parent in parents:
    from goal_evaluator import evaluate_sponsor_goals
    goal_result = await evaluate_sponsor_goals(supabase, parent)
    print(f"  Sponsor goals [{parent}]: {goal_result.get('goals_completed', 0)} awarded")
```

Also update the `evaluate-goals` CLI command to accept any stage-race slug (no behavior change needed beyond the function rename).

- [ ] **Step 5: Run tests**

Run: `.venv/bin/python -m pytest tests/test_goal_evaluator.py -k one_week -v`
Expected: PASS.

- [ ] **Step 6: Run the FULL goal_evaluator suite**

Run: `.venv/bin/python -m pytest tests/test_goal_evaluator.py -v`
Expected: All PASS (update any legacy test asserting old amounts/150k/`tieredWith`).

- [ ] **Step 7: Commit**

```bash
git add services/pcs-sync/goal_evaluator.py services/pcs-sync/run_pipeline.py services/pcs-sync/tests/test_goal_evaluator.py
git commit -m "feat(goal-eval): extend sponsor goals to 1-week stage races (×1)"
```

---

### Task 12: Regenerate TS types + typecheck

**Files:**
- Modify: `apps/web/lib/database.types.ts` (only if schema columns changed — they did not in Phase 1; sponsors columns unchanged, only values). Skip regen if no schema change.

- [ ] **Step 1: Typecheck web**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm --filter web typecheck`
Expected: PASS (gt-goals.ts changes compile).

- [ ] **Step 2: Commit (if any)**

```bash
git add -A && git commit -m "chore: typecheck after goal-set refactor"
```

---

## Phase 3 — Giro Cutover + Reconciliation

### Task 13: Reconciliation script (read-only) + double-count guard

**Files:**
- Create: `services/pcs-sync/reconcile_bonuses.py`
- Test: `services/pcs-sync/tests/test_reconcile_bonuses.py`

- [ ] **Step 1: Write failing test for the double-count guard**

```python
def test_detects_points_double_count():
    """A team with BOTH an old 'Wear ciclamino' completion AND a new
    'Win the points classification' for the same GT+rider is flagged."""
    from reconcile_bonuses import find_points_double_counts
    completions = [
        {"team_id": "t1", "rider_id": "r1", "goal_label": "Wear ciclamino",
         "race_slug": "race/giro-d-italia/2026"},
        {"team_id": "t1", "rider_id": "r1", "goal_label": "Win the points classification",
         "race_slug": "race/giro-d-italia/2026"},
    ]
    flags = find_points_double_counts(completions)
    assert flags == [("t1", "r1", "race/giro-d-italia/2026")]
```

- [ ] **Step 2: Run to verify fail**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && .venv/bin/python -m pytest tests/test_reconcile_bonuses.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement the guard + a treasury reconciliation report**

```python
"""Read-only Giro reconciliation: verify treasury == sum of credited bonuses,
and flag old-vs-new points/kom double-counts at the cutover."""

OLD_POINTS_LABELS = {"Wear ciclamino", "Wear maglia ciclamino"}
NEW_POINTS_LABEL = "Win the points classification"


def find_points_double_counts(completions: list[dict]) -> list[tuple]:
    """Flag (team, rider, race) that have BOTH an old points-jersey completion
    and the new 'Win the points classification' for the same GT."""
    by_key: dict[tuple, set[str]] = {}
    for c in completions:
        key = (c["team_id"], c["rider_id"], c["race_slug"])
        by_key.setdefault(key, set()).add(c["goal_label"])
    flags = []
    for key, labels in by_key.items():
        if labels & OLD_POINTS_LABELS and NEW_POINTS_LABEL in labels:
            flags.append(key)
    return sorted(flags)


async def reconcile_team_treasury(supabase, league_id: str) -> list[dict]:
    """For each team: compare treasury_log sum of bonus credits to the sum of
    sponsor_bonuses.final_bonus + sponsor_goal_completions.final_reward. Report deltas."""
    # read-only aggregation; returns [{team_id, expected, logged, delta}]
    ...
```

- [ ] **Step 4: Run tests**

Run: `.venv/bin/python -m pytest tests/test_reconcile_bonuses.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/pcs-sync/reconcile_bonuses.py services/pcs-sync/tests/test_reconcile_bonuses.py
git commit -m "feat(reconcile): Giro double-count guard + treasury reconciliation report"
```

---

### Task 14: Cutover runbook

**Files:**
- Create: `docs/runbooks/2026-06-03-giro-cutover.md`

- [ ] **Step 1: Write the runbook** (operational sequence — no claw-back)

```markdown
# Giro Cutover Runbook (Spec C — Grandfather)

Goal: stage results (incl. stage 21) keep the OLD barème; final classifications
(GC/points/KOM/youth) use the NEW barème. No claw-back of paid bonuses.

## Order of operations (LOCAL, residential IP)

1. **BEFORE deploying the new barème** — sync Giro stage 21 on the CURRENT (old) code:
   `git checkout main && .venv/bin/python run_pipeline.py post-race --race "race/giro-d-italia/2026/stage-21"`
   → bakes stage-21 stage bonus + "Win a stage" goal at OLD amounts (e.g. Milan 20k + 50k = 70k).
2. **Deploy new barème**: confirm with user → `supabase db push --linked` (Task 1 migration) → merge the Spec C branch.
3. **Sync the Giro FINAL classifications** on the NEW code:
   `.venv/bin/python run_pipeline.py post-race --race "race/giro-d-italia/2026/gc"`
   (imports gt_final_classifications via import_final_classifications) then
   `.venv/bin/python run_pipeline.py evaluate-goals --race "race/giro-d-italia/2026"`
   → GC podium/top5/Race Leader/youth + points/KOM finals at NEW amounts (podium GC 60k, not 150k).
4. **Reconcile**: `.venv/bin/python -c "import asyncio, reconcile_bonuses; ..."` → review treasury deltas + double-count flags. Any flag → manual revert via a `sponsor_bonus_revert` treasury_log line (audited).

## Idempotency notes
- sponsor_bonuses is idempotent on (team_id, rider_id, race_slug, result_type).
- sponsor_goal_completions is idempotent on (team_id, sponsor_id, goal_index) per race_slug.
- The pre-existing Giro stage/goal completions are NOT re-credited (grandfathered).
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/2026-06-03-giro-cutover.md
git commit -m "docs(runbook): Giro cutover sequence (grandfather, no claw-back)"
```

---

### Task 15: Living docs update (Rule #4)

**Files:**
- Modify: `docs/GAME_RULES.md` (§11 constants — sponsor barème, nationality ×1.20)
- Modify: `docs/ARCHITECTURE.md` (goal_evaluator 1-week extension, reconcile_bonuses, gt_final_classifications usage by goals)
- Move: spec C → `docs/archive/specs/` once shipped.

- [ ] **Step 1: Update GAME_RULES.md §11** with the new sponsor barème table (T1–T6 A values + thresholds) and nationality ×1.20. Show the table from this plan's "Locked decisions".

- [ ] **Step 2: Update ARCHITECTURE.md** — note `evaluate_sponsor_goals` (GT + 1-week), the `gt_final_classifications` read path for points/KOM finals, and `reconcile_bonuses.py`.

- [ ] **Step 3: Commit**

```bash
git add docs/GAME_RULES.md docs/ARCHITECTURE.md
git commit -m "docs: Spec C barème in GAME_RULES §11 + ARCHITECTURE goal-eval/reconcile"
```

---

## Self-Review

**Spec coverage check (Spec C §C1–C4 + resolved questions):**
- C1 base bonus 2-value + thresholds → Task 1 (migration) + Tasks 2–3 (runtime ×2). ✓
- C1 nationality ×1.20 T1–T4 → Task 3. ✓
- C2 goals barème per archetype + tierGroup best-of → Tasks 5, 6, 10. ✓
- C2 Race Leader / youth / KOM tracking → Tasks 5, 7, 8. ✓
- C2 sprinter profile gating → Task 9. ✓
- C3 sponsor→archetype mapping → Tasks 5, 6. ✓
- C4 Rétroactif Giro (grandfather, cutover, Milan, double-count, reconciliation) → Tasks 13, 14. ✓
- Resolved Q-D2 youth → Task 8; Q-D3 KOM → Tasks 7, 8; Q9 Visma/RedBull → Tasks 5, 6; Q12 Option 1 → Tasks 13, 14. ✓
- 1-week goal extension (user decision) → Task 11. ✓
- C4 UI (sponsor card 2-columns) → **OUT OF SCOPE** (separate UI plan, with wireframes + `<RiderPrice>` / Spec D). `orientation` column kept here, dropped there.

**Placeholder scan:** Task 11 Step 1 and Task 13 Step 3 use `...` for mock-wiring/aggregation bodies that must mirror existing patterns in the same files — flagged inline with the exact pattern to copy (existing `evaluate_gt_goals` integration test; read-only aggregation). Executor must fill them following the cited reference, not invent.

**Type/name consistency:** `evaluate_sponsor_goals` (new) / `evaluate_gt_goals` (alias); `gt_reward_multiplier`; `_is_doubled` / `_base_and_threshold` (sponsor_bonus); `tierGroup` (TS) / `tier_group` (py); `final_classifications` ctx key; evaluator ids match `EVALUATORS` dict keys (`win_kom_classification`, `wear_youth_jersey`, `wear_kom_jersey`). Consistent across tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-03-spec-c-bonus-economy-backend.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch with checkpoints.

Which approach?
