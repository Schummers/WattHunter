# Sponsor GT Goals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework base bonuses to flat amounts (no x2 multipliers), add 6 GT-specific goals per T4 sponsor with role-gating, and update the sponsor card UI.

**Architecture:** Update `gt-goals.ts` data + interface, rewrite `BaseBonusContent` and `GtGoalsPreview` components to match validated wireframe, update `SponsorBonusDetails` to remove Multipliers section, add DB migration for flat bonus amounts. Orientation becomes a multi-value string (e.g. "gc/tt") instead of single enum.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS v4, Supabase Postgres

---

### Task 1: Update GtGoal Interface + T4 Goal Data

**Files:**
- Modify: `apps/web/lib/gt-goals.ts`

- [ ] **Step 1: Update the GtGoal interface**

Replace the existing interface and data with the new schema. The interface adds `role` and `tieredWith` fields:

```typescript
export interface GtGoal {
  label: string;
  reward: number;
  role: "gc_leader" | "sprinter" | "climber" | "tt_specialist" | "stage_hunter" | null;
  tieredWith?: number; // index of the other tiered goal (best-of-two)
}
```

- [ ] **Step 2: Replace all 13 sponsor goal sets with validated data**

Replace the entire `GT_GOALS` array. T4 sponsors get 6 goals each (validated in spec). T1-T3 and T5-T6 keep empty arrays (no sponsor-specific goals for now — they have base bonuses only displayed in a different section).

```typescript
export interface GtGoal {
  label: string;
  reward: number;
  role: "gc_leader" | "sprinter" | "climber" | "tt_specialist" | "stage_hunter" | null;
  tieredWith?: number;
}

export interface GtGoalSet {
  sponsorSlug: string;
  goals: GtGoal[];
}

/**
 * GT-specific goals — T4 sponsors only. Display + future evaluation.
 * V1a: display only. V1b adds evaluation + payout.
 * Spec: docs/superpowers/specs/2026-05-03-sponsor-gt-goals-design.md
 */
export const GT_GOALS: GtGoalSet[] = [
  // T1 — no specific goals
  { sponsorSlug: "lotto", goals: [] },
  // T2 — no specific goals
  { sponsorSlug: "astana", goals: [] },
  // T3 — no specific goals (deferred)
  { sponsorSlug: "groupama", goals: [] },
  { sponsorSlug: "movistar", goals: [] },
  { sponsorSlug: "alpecin", goals: [] },
  { sponsorSlug: "unox", goals: [] },

  // T4 — Ineos Grenadiers (GC + TT, nat: GB)
  { sponsorSlug: "ineos", goals: [
    { label: "Podium GC final", reward: 150_000, role: "gc_leader", tieredWith: 1 },
    { label: "Top 5 GC final", reward: 75_000, role: "gc_leader", tieredWith: 0 },
    { label: "Win an ITT", reward: 50_000, role: "tt_specialist" },
    { label: "Wear maglia rosa", reward: 50_000, role: "gc_leader" },
    { label: "Wear maglia bianca", reward: 40_000, role: "gc_leader" },
    { label: "2 riders in top 10 of an ITT", reward: 25_000, role: null },
  ]},

  // T4 — Decathlon AG2R (GC + Sprint, nat: FR)
  { sponsorSlug: "decathlon", goals: [
    { label: "Podium GC final", reward: 150_000, role: "gc_leader", tieredWith: 1 },
    { label: "Top 5 GC final", reward: 75_000, role: "gc_leader", tieredWith: 0 },
    { label: "Win a stage", reward: 50_000, role: "sprinter" },
    { label: "Wear maglia rosa", reward: 50_000, role: "gc_leader" },
    { label: "Wear ciclamino", reward: 40_000, role: "sprinter" },
    { label: "Wear maglia bianca", reward: 40_000, role: "gc_leader" },
  ]},

  // T4 — Soudal Quick-Step (Sprint + Stage Hunter, nat: BE)
  { sponsorSlug: "soudal", goals: [
    { label: "Win points classification", reward: 150_000, role: "sprinter" },
    { label: "Win 2 stages", reward: 75_000, role: "sprinter", tieredWith: 4 },
    { label: "2 different riders win a stage", reward: 75_000, role: null },
    { label: "Win a stage", reward: 60_000, role: "stage_hunter" },
    { label: "Win a stage", reward: 50_000, role: "sprinter", tieredWith: 1 },
    { label: "Wear ciclamino", reward: 50_000, role: "sprinter" },
  ]},

  // T4 — Lidl-Trek (Sprint + Stage Hunter, nat: US/IT) — identical goals to Soudal
  { sponsorSlug: "lidl-trek", goals: [
    { label: "Win points classification", reward: 150_000, role: "sprinter" },
    { label: "Win 2 stages", reward: 75_000, role: "sprinter", tieredWith: 4 },
    { label: "2 different riders win a stage", reward: 75_000, role: null },
    { label: "Win a stage", reward: 60_000, role: "stage_hunter" },
    { label: "Win a stage", reward: 50_000, role: "sprinter", tieredWith: 1 },
    { label: "Wear ciclamino", reward: 50_000, role: "sprinter" },
  ]},

  // T5 — no specific goals (keep base bonus only)
  { sponsorSlug: "visma", goals: [] },
  { sponsorSlug: "redbull-bora", goals: [] },
  // T6 — no specific goals
  { sponsorSlug: "uae", goals: [] },
];

export function getGoalsForSponsor(slug: string): GtGoal[] {
  return GT_GOALS.find((g) => g.sponsorSlug === slug)?.goals ?? [];
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm typecheck`
Expected: no errors in `gt-goals.ts`. Other files that import `GtGoal` may error because they don't know about the new `role` field yet — that's expected and will be fixed in Task 3.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/gt-goals.ts
git commit -m "feat: update GtGoal interface with role + tieredWith, add validated T4 goals"
```

---

### Task 2: Add Orientation Tags Support

**Files:**
- Modify: `apps/web/lib/sponsors.ts`
- Modify: `apps/web/components/sponsor-bonus-card.tsx` (header section only in this task)

The spec requires multiple orientation tags per sponsor (e.g. "GC + TT", "Sprint + Stage Hunter"). Currently `orientation` is a single enum `"gc" | "one_day" | "neutral"`. We need a mapping from sponsor slug to display tags, since the DB column stays as-is (the orientation field in DB still drives base bonus ordering logic).

- [ ] **Step 1: Add orientation display map to sponsors.ts**

Add a new constant below `ORIENTATION_LABELS` in `apps/web/lib/sponsors.ts`:

```typescript
/**
 * Display-oriented tags per sponsor slug.
 * T4+ sponsors can have multiple orientation tags.
 * Falls back to ORIENTATION_LABELS[orientation] for sponsors not in this map.
 */
export const SPONSOR_ORIENTATION_TAGS: Record<string, string[]> = {
  ineos: ["GC", "TT"],
  decathlon: ["GC", "Sprint"],
  soudal: ["Sprint", "Stage Hunter"],
  "lidl-trek": ["Sprint", "Stage Hunter"],
};

/**
 * Get display tags for a sponsor. Returns array of tag strings.
 * Uses slug-specific override if available, else falls back to orientation label.
 */
export function getOrientationTags(sponsor: SponsorRow): string[] {
  if (SPONSOR_ORIENTATION_TAGS[sponsor.slug]) {
    return SPONSOR_ORIENTATION_TAGS[sponsor.slug];
  }
  const label = ORIENTATION_LABELS[sponsor.orientation];
  return label && label !== "neutral" ? [label] : [];
}
```

- [ ] **Step 2: Update SponsorBonusCard header to use multiple tags**

In `apps/web/components/sponsor-bonus-card.tsx`, update the header button to render multiple orientation tags + nationality flag tag. Replace the single `<Tag>` with a map over `getOrientationTags()`, and move the nationality flags into a highlighted tag.

Replace the header button content inside `SponsorBonusCard`:

```tsx
{/* Tags row — below name, orientation + flag */}
<div className="flex items-center gap-1.5 flex-wrap">
  {getOrientationTags(sponsor).map((tag) => (
    <Tag key={tag} variant="highlighted">{tag}</Tag>
  ))}
  {nationalities.length > 0 && (
    <Tag variant="highlighted">
      {nationalities.map((nat) => countryCodeToFlag(nat)).join(" ")}
    </Tag>
  )}
</div>
```

The header layout changes from single-line (name + tag + flags + budget) to two-line:
- Line 1: Name (left) + Budget (right)  
- Line 2: Orientation tags + flag tag

Import `getOrientationTags` from `@/lib/sponsors`.

Full updated header button:

```tsx
<button
  type="button"
  onClick={onToggle}
  className="flex w-full flex-col gap-1 px-3.5 py-3 text-left hover:bg-[var(--bg-surface-hover)] rounded-[var(--radius-lg)] transition-colors"
>
  {/* Line 1: Name + Budget */}
  <div className="flex w-full items-center gap-2.5">
    <span className="text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)]">
      {sponsor.name}
    </span>
    <span className="ml-auto font-[family-name:var(--font-geist-mono)] text-[length:var(--type-emphasis)] font-semibold text-[var(--text-high)] tabular-nums">
      {formatBudget(sponsor.monthly_budget)}
    </span>
    <ChevronDown
      size={16}
      className={cn(
        "shrink-0 text-[var(--text-low)] transition-transform duration-200",
        expanded && "rotate-180",
      )}
    />
  </div>
  {/* Line 2: Tags */}
  <div className="flex items-center gap-1.5 flex-wrap">
    {getOrientationTags(sponsor).map((tag) => (
      <Tag key={tag} variant="highlighted">{tag}</Tag>
    ))}
    {nationalities.length > 0 && (
      <Tag variant="highlighted">
        {nationalities.map((nat) => countryCodeToFlag(nat)).join(" ")}
      </Tag>
    )}
  </div>
</button>
```

- [ ] **Step 3: Verify the header renders correctly**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm build`
Expected: build succeeds, no type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/sponsors.ts apps/web/components/sponsor-bonus-card.tsx
git commit -m "feat: add multi-orientation tags + flag tag in sponsor card header"
```

---

### Task 3: Rewrite BaseBonusContent (flat layout, no x2)

**Files:**
- Modify: `apps/web/components/sponsor-bonus-card.tsx` (BaseBonusContent function)

The current `BaseBonusContent` shows two columns: base amount + "if Grand Tour/Monument" with x2 amounts. The new layout is flat: one column with label + amount, no x2.

- [ ] **Step 1: Rewrite BaseBonusContent**

Replace the entire `BaseBonusContent` function. New layout:
- Section header: "BASE BONUS (cumulative)" in uppercase, `--text-low`
- 3 lines, compact:
  - Left: label in `--text-high` (e.g. "Top 10 GC")
  - Right: amount in `--text-high`, font-semibold, Geist Mono (e.g. "+50K")
- Nationality footer: T3+ only

```tsx
/** Inline bonus content for Tiers 1-4 (flat layout, no multipliers) */
function BaseBonusContent({ sponsor }: { sponsor: SponsorRow }) {
  const nationalities = sponsor.nationality
    ? sponsor.nationality.split("/").map((c) => c.trim())
    : [];

  return (
    <div>
      <div className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)] mt-1 pt-2 border-t border-[var(--border-default)]">
        Base Bonus (cumulative)
      </div>
      {sponsor.bonus_gc > 0 && (
        <div className="flex items-baseline justify-between py-1">
          <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
            {thresholdLabel(sponsor.gc_threshold)} GC
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] font-semibold text-[var(--text-high)] tabular-nums">
            +{formatBudget(sponsor.bonus_gc)}
          </span>
        </div>
      )}
      {sponsor.bonus_stage > 0 && (
        <div className="flex items-baseline justify-between py-1">
          <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
            {thresholdLabel(sponsor.stage_threshold)} Stage
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] font-semibold text-[var(--text-high)] tabular-nums">
            +{formatBudget(sponsor.bonus_stage)}
          </span>
        </div>
      )}
      {sponsor.bonus_one_day > 0 && (
        <div className="flex items-baseline justify-between py-1">
          <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
            {thresholdLabel(sponsor.one_day_threshold)} One-Day
          </span>
          <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] font-semibold text-[var(--text-high)] tabular-nums">
            +{formatBudget(sponsor.bonus_one_day)}
          </span>
        </div>
      )}
      {nationalities.length > 0 && (
        <div className="flex items-center gap-1.5 border-t border-[var(--border-default)] mt-2.5 pt-2.5 text-[length:var(--type-caption)] text-[var(--text-low)]">
          {nationalities.map((nat) => (
            <span key={nat}>{countryCodeToFlag(nat)}</span>
          ))}
          <span>
            {nationalities
              .map((nat) => NATIONALITY_DEMONYMS[nat] ?? nat)
              .join(" / ")}{" "}
            rider: all bonuses ×1.25
          </span>
        </div>
      )}
    </div>
  );
}
```

Key changes from current code:
- Removed `isGcFirst` / orientation-based ordering — always show GC, Stage, One-Day
- Removed the "if Grand Tour" / "if Monument" column with x2 amounts
- Removed the `border-t border-[var(--border-subtle)]` divider between GC/Stage and One-Day groups
- Labels use `--text-high` instead of `--text-mid`
- Amounts use `--text-high` + `font-semibold` instead of `--text-low`
- Section header changed from "Base Bonus" to "Base Bonus (cumulative)"

- [ ] **Step 2: Verify build**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/sponsor-bonus-card.tsx
git commit -m "feat: rewrite BaseBonusContent with flat layout, remove x2 multipliers"
```

---

### Task 4: Rewrite GtGoalsPreview (role display + sponsor bonus header)

**Files:**
- Modify: `apps/web/components/gt-goals-preview.tsx`

The current component shows a simple list with "Preview (V1b)" tag. The new layout:
- Section header: "SPONSOR BONUS (unique)" — uppercase, `--text-low`
- No "Preview (V1b)" tag
- Each goal line: label in `--text-high` + role in `--text-mid` (same font size, just color) + amount right-aligned
- Role "null" (All roles) shows "All" in `--text-mid`
- T4+ only — component already guards this (caller passes empty array for non-T4)

- [ ] **Step 1: Rewrite GtGoalsPreview**

```tsx
import { formatBudget } from "@/lib/sponsors";
import type { GtGoal } from "@/lib/gt-goals";

const ROLE_LABELS: Record<string, string> = {
  gc_leader: "GC Leader",
  sprinter: "Sprinter",
  climber: "Climber",
  tt_specialist: "TT Specialist",
  stage_hunter: "Stage Hunter",
};

export function GtGoalsPreview({ goals }: { goals: GtGoal[] }) {
  if (!goals.length) return null;
  return (
    <div className="mt-3 border-t border-[var(--border-default)] pt-3">
      <div className="mb-2">
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-wide text-[var(--text-low)]">
          Sponsor Bonus (unique)
        </span>
      </div>
      <ul className="flex flex-col">
        {goals.map((g, i) => (
          <li key={`${g.label}-${i}`} className="flex items-baseline justify-between py-1">
            <span className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[length:var(--type-caption)] text-[var(--text-high)]">
                {g.label}
              </span>
              <span className="text-[length:var(--type-caption)] text-[var(--text-mid)] shrink-0">
                {g.role ? ROLE_LABELS[g.role] ?? g.role : "All"}
              </span>
            </span>
            <span className="font-[family-name:var(--font-geist-mono)] text-[length:var(--type-caption)] font-semibold text-[var(--text-high)] tabular-nums shrink-0 ml-2">
              +{formatBudget(g.reward)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Key changes:
- Removed `Tag` import and "Preview (V1b)" badge
- Section header: "GT Goals" → "Sponsor Bonus (unique)"
- Added `ROLE_LABELS` map for display
- Label uses `--text-high` (was `--text-mid`)
- Role displayed as inline text in `--text-mid` after the label (not a badge)
- Amount uses `--text-high` + `font-semibold` (was `--text-low`)
- Key uses index to handle duplicate labels (Soudal has two "Win a stage" goals)
- Removed `gap-1` from `ul` — using `py-1` on items for tight spacing

- [ ] **Step 2: Verify build**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm build`
Expected: build succeeds. The `Tag` import removal should not cause issues.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/gt-goals-preview.tsx
git commit -m "feat: rewrite GtGoalsPreview with role display + sponsor bonus header"
```

---

### Task 5: Update SponsorBonusDetails (remove Multipliers section)

**Files:**
- Modify: `apps/web/components/sponsor-bonus-details.tsx`

This component is used in the marketplace expanded view. It currently has a "Multipliers" section showing x2 for Monuments & Grand Tours. Remove that entire section. Update labels to `--text-high`. Keep the T5/T6 prestige path unchanged (they still have their own bonus structure).

- [ ] **Step 1: Remove the Multipliers section and update label colors**

In `sponsor-bonus-details.tsx`:

1. Remove the entire `{/* MULTIPLIERS */}` block (lines 100-123) — the `{!sponsor.has_explicit_prestige && (` section
2. In the `BonusLine` component, change label color from `--text-mid` to `--text-high`
3. In the T5/T6 prestige branch (lines 66-97), remove the `suffix="(×2 GT)"` from the Stage line (line 81)

Updated `BonusLine`:

```tsx
function BonusLine({
  label,
  threshold,
  bonus,
}: {
  label: string;
  threshold: number;
  bonus: number;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[length:var(--type-body)] text-[var(--text-high)]">
        {thresholdLabel(threshold)} — {label}
      </span>
      <span className="font-mono text-[length:var(--type-body)] font-medium text-[var(--text-high)] tabular-nums">
        +{formatBudget(bonus)}
      </span>
    </div>
  );
}
```

Updated `SponsorBonusDetails` — remove `suffix` prop from BonusLine, remove Multipliers section:

```tsx
export function SponsorBonusDetails({ sponsor }: { sponsor: SponsorRow }) {
  return (
    <div className="mt-3 space-y-3">
      {/* BASE BONUS */}
      <div>
        <span className="text-[length:var(--type-label)] font-bold uppercase tracking-[var(--tracking-wide)] text-[var(--text-low)] block mb-2">
          Base Bonus
        </span>
        <div className="space-y-0.5">
          {sponsor.has_explicit_prestige ? (
            <>
              {sponsor.bonus_one_day > 0 && (
                <BonusLine label="One-Day" threshold={sponsor.one_day_threshold} bonus={sponsor.bonus_one_day} />
              )}
              {sponsor.bonus_monument != null && sponsor.bonus_monument > 0 && sponsor.monument_threshold != null && (
                <BonusLine label="Monument" threshold={sponsor.monument_threshold} bonus={sponsor.bonus_monument} />
              )}
              {sponsor.bonus_gc > 0 && (
                <BonusLine label="Stage Race GC" threshold={sponsor.gc_threshold} bonus={sponsor.bonus_gc} />
              )}
              {sponsor.bonus_grand_tour != null && sponsor.bonus_grand_tour > 0 && sponsor.grand_tour_threshold != null && (
                <BonusLine label="Grand Tour GC" threshold={sponsor.grand_tour_threshold} bonus={sponsor.bonus_grand_tour} />
              )}
              {sponsor.bonus_stage > 0 && (
                <BonusLine label="Stage" threshold={sponsor.stage_threshold} bonus={sponsor.bonus_stage} />
              )}
            </>
          ) : (
            <>
              {sponsor.bonus_gc > 0 && (
                <BonusLine label="GC" threshold={sponsor.gc_threshold} bonus={sponsor.bonus_gc} />
              )}
              {sponsor.bonus_one_day > 0 && (
                <BonusLine label="One-Day" threshold={sponsor.one_day_threshold} bonus={sponsor.bonus_one_day} />
              )}
              {sponsor.bonus_stage > 0 && (
                <BonusLine label="Stage" threshold={sponsor.stage_threshold} bonus={sponsor.bonus_stage} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/sponsor-bonus-details.tsx
git commit -m "fix: remove x2 Multipliers section, update labels to --text-high"
```

---

### Task 6: DB Migration — Flat Base Bonus Amounts

**Files:**
- Create: `supabase/migrations/20260506000000_flat_base_bonuses.sql`

Update all T1-T4 sponsor bonus amounts to flat values (same for all sponsors within a tier). No orientation-specific differences. Thresholds also updated per spec.

- [ ] **Step 1: Write the migration**

```sql
-- Migration: Flat base bonuses for T1-T4 sponsors
-- Spec: docs/superpowers/specs/2026-05-03-sponsor-gt-goals-design.md (Section 2)
-- Removes orientation-specific bonus differences within tiers.
-- T5/T6 unchanged (out of scope).

-- T1: Lotto — Top 25 GC 5K, Top 10 Stage 2.5K, Top 25 One-Day 5K
UPDATE public.sponsors SET
  bonus_gc = 5000, gc_threshold = 25,
  bonus_stage = 2500, stage_threshold = 10,
  bonus_one_day = 5000, one_day_threshold = 25
WHERE tier = 1;

-- T2: Astana — Top 20 GC 10K, Top 10 Stage 5K, Top 20 One-Day 10K
UPDATE public.sponsors SET
  bonus_gc = 10000, gc_threshold = 20,
  bonus_stage = 5000, stage_threshold = 10,
  bonus_one_day = 10000, one_day_threshold = 20
WHERE tier = 2;

-- T3: Groupama, Movistar, Alpecin, Uno-X — Top 15 GC 25K, Top 5 Stage 10K, Top 15 One-Day 20K
UPDATE public.sponsors SET
  bonus_gc = 25000, gc_threshold = 15,
  bonus_stage = 10000, stage_threshold = 5,
  bonus_one_day = 20000, one_day_threshold = 15
WHERE tier = 3;

-- T4: Ineos, Decathlon, Soudal, Lidl-Trek — Top 10 GC 50K, Podium Stage 20K, Top 10 One-Day 25K
UPDATE public.sponsors SET
  bonus_gc = 50000, gc_threshold = 10,
  bonus_stage = 20000, stage_threshold = 3,
  bonus_one_day = 25000, one_day_threshold = 10
WHERE tier = 4;
```

- [ ] **Step 2: Verify migration syntax**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && cat supabase/migrations/20260506000000_flat_base_bonuses.sql`
Expected: file exists with correct SQL.

- [ ] **Step 3: Apply migration to remote**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && supabase db push`
Expected: migration applied successfully. Verify with:
```sql
SELECT slug, tier, bonus_gc, bonus_one_day, bonus_stage, gc_threshold, one_day_threshold, stage_threshold FROM sponsors WHERE tier <= 4 ORDER BY tier, sort_order;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260506000000_flat_base_bonuses.sql
git commit -m "fix: flat base bonus amounts for T1-T4 sponsors, remove orientation split"
```

---

### Task 7: Update sponsor_bonus.py — Remove x2 Multiplier for T1-T4

**Files:**
- Modify: `services/pcs-sync/sponsor_bonus.py`

The `_calculate_bonus_t1_t4` function currently applies x2 for grand_tour, monument, and GT stages. Remove these multipliers. Keep nationality x1.25 (already correct).

- [ ] **Step 1: Remove x2 multiplier logic from _calculate_bonus_t1_t4**

In `services/pcs-sync/sponsor_bonus.py`, the `_calculate_bonus_t1_t4` function (line 98-141), remove lines 126-131:

```python
    # ×2 for prestige events — REMOVED per 2026-05-03 spec
    # if result_type == "grand_tour":
    #     multiplier *= 2.0
    # elif result_type == "monument":
    #     multiplier *= 2.0
    # elif result_type == "stage" and _is_grand_tour_slug(race_slug):
    #     multiplier *= 2.0
```

The function becomes:

```python
def _calculate_bonus_t1_t4(
    sponsor: dict,
    result_type: str,
    rank: int,
    rider_nationality: Optional[str],
    race_slug: str,
) -> tuple[int, float, int]:
    """Bonus logic for T1-T4 sponsors — flat amounts, no x2 prestige multiplier."""
    # Determine base amount and threshold
    if result_type in ("gc", "grand_tour"):
        base = sponsor["bonus_gc"]
        threshold = sponsor["gc_threshold"]
    elif result_type in ("one_day", "monument"):
        base = sponsor["bonus_one_day"]
        threshold = sponsor["one_day_threshold"]
    elif result_type == "stage":
        base = sponsor["bonus_stage"]
        threshold = sponsor["stage_threshold"]
    else:
        return (0, 0.0, 0)

    if rank > threshold:
        return (0, 0.0, 0)

    # Build multiplier — nationality only
    multiplier = 1.0

    # ×1.25 for nationality match
    sponsor_nat = sponsor.get("nationality")
    if sponsor_nat and rider_nationality:
        allowed = expand_sponsor_nationality(sponsor_nat)
        if rider_nationality in allowed:
            multiplier *= 1.25

    final = int(base * multiplier)
    return (base, multiplier, final)
```

Note: Keep `_is_grand_tour_slug` and `GRAND_TOUR_SLUGS` — still used by T5/T6 in `_calculate_bonus_t5_t6`.

- [ ] **Step 2: Run existing tests**

Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && python -m pytest tests/ -v`
Expected: some tests may fail because they assert x2 multiplier behavior. Fix the test expectations to match new flat bonus logic.

- [ ] **Step 3: Fix failing tests if any**

Update test assertions that expected x2 multipliers for T1-T4 sponsors. The new expected behavior:
- Grand Tour GC result: same bonus as regular GC (no x2)
- Monument result: same bonus as regular One-Day (no x2)
- GT stage: same bonus as regular stage (no x2)
- Nationality x1.25: unchanged

- [ ] **Step 4: Commit**

```bash
git add services/pcs-sync/sponsor_bonus.py services/pcs-sync/tests/
git commit -m "fix: remove x2 GT/Monument multiplier for T1-T4 sponsors"
```

---

### Task 8: Final Verification + Spec Commit

- [ ] **Step 1: Full typecheck**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 2: Full build**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Run all tests**

Run: `cd /Users/jonathanschummers/Documents/WattHunter && pnpm test`
Run: `cd /Users/jonathanschummers/Documents/WattHunter/services/pcs-sync && python -m pytest tests/ -v`
Expected: all tests pass.

- [ ] **Step 4: Commit updated spec**

```bash
git add docs/superpowers/specs/2026-05-03-sponsor-gt-goals-design.md
git commit -m "docs: update spec with backend V1b section + goal corrections"
```

- [ ] **Step 5: Visual smoke test**

Open the app locally (`pnpm dev`), navigate to:
1. GT Team tab → verify sponsor card shows new layout with tags below name, flat base bonuses, sponsor bonus section with roles
2. Budget page → verify marketplace shows flat bonuses without x2 columns
3. T1/T2 sponsors → verify no "Sponsor Bonus (unique)" section
4. T3 sponsors → verify base bonus section + nationality footer, no sponsor bonus section
5. T4 sponsors → verify all 6 goals displayed with correct role labels and amounts
