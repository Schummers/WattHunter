# Sponsor Base Bonuses Rework + GT Specific Goals — Design Spec

**Date:** 2026-05-03 (updated 2026-05-05)
**Status:** Validated
**Scope:** Rework base bonuses for all tiers (T1-T4) + define GT-specific goals for T4 sponsors
**Replaces:** Sections 3.2 of `docs/superpowers/specs/2026-04-02-sponsors-rework-design.md` (T1-T4 bonus tables + multipliers)
**Related:** `docs/plans/2026-04-20-grand-tour-mode-backlog.md` (V1b section)

---

## 1. What Changes

### Removed
- **×2 Grand Tour multiplier** — deleted for all tiers
- **×2 Monument multiplier** — deleted for all tiers
- **Orientation-specific base bonuses** (GC vs One-Day had different amounts) — all sponsors within a tier now share identical base bonuses
- **Old nationality multiplier ×1.5** — replaced by ×1.25

### Added
- **Flat base bonuses** — same amounts for all sponsors within a tier, no conditional multipliers
- **GT Specific Goals** — 6 goals per T4 sponsor, role-gated, cash rewards only
- **Nationality ×1.25** — applies to base bonuses + specific goals (T3-T4 only)

### Unchanged
- T5/T6 sponsors keep their current 4-5 line format (out of scope)
- XP calculation unchanged
- Salary formula unchanged
- Sponsor switch timing unchanged

---

## 2. Base Bonuses — All Tiers

Identical for every sponsor within the same tier. No orientation split. Cumulative (paid on every qualifying result).

| Tier | Sponsors | GC | Stage | One-Day Race | Nat ×1.25 |
|------|----------|-----|-------|--------------|-----------|
| **T1** (Lv.1) | Lotto | Top 25 → **5K** | Top 10 → **2.5K** | Top 25 → **5K** | no |
| **T2** (Lv.2) | Astana | Top 20 → **10K** | Top 10 → **5K** | Top 20 → **10K** | no |
| **T3** (Lv.3) | Groupama, Movistar, Alpecin, Uno-X | Top 15 → **25K** | Top 5 → **10K** | Top 15 → **20K** | yes |
| **T4** (Lv.5) | Ineos, Decathlon, Soudal, Lidl-Trek | Top 10 → **50K** | Podium → **20K** | Top 10 → **25K** | yes |

### Progression
- **GC thresholds:** 25 → 20 → 15 → 10
- **Stage thresholds:** 10 → 10 → 5 → 3 (podium)
- **One-Day thresholds:** 25 → 20 → 15 → 10
- **GC amounts:** 5K → 10K → 25K → 50K
- **Stage amounts:** 2.5K → 5K → 10K → 20K
- **One-Day amounts:** 5K → 10K → 20K → 25K

### Nationality ×1.25
- T1-T2: no nationality bonus
- T3: Groupama (FR), Movistar (ES), Alpecin (BE/NL), Uno-X (DK/NO)
- T4: Ineos (GB), Decathlon (FR), Soudal (BE), Lidl-Trek (US/IT)
- Applied to both base bonuses and specific goals
- Example: 50K × 1.25 = 62.5K for a matching rider

---

## 3. GT Specific Goals — T4 Only (T1/T2/T3 have base bonus only, no sponsor bonus section)

### Terminology
- **Base bonuses** = cumulative (paid on every qualifying race result, can fire multiple times per GT)
- **Sponsor bonus** = unique (each goal pays at most once per GT, strikethrough when achieved)

### Rules

- Available **only during Grand Tours** (Giro / Tour / Vuelta)
- Each T4 sponsor has **6 fixed goals** — not chosen by the player
- Each goal pays **at most once** per GT (unique). Once achieved → strikethrough in UI.
- **Tiered goals** = best of two, not cumulative. Example: "Podium GC" (150K) and "Top 5 GC" (75K) — if rider finishes 2nd, pays 150K only, not 225K.
- Rewards = **cash only** (no XP)
- Nationality ×1.25 applies to goal rewards
- Some goals are **role-gated** (only the rider assigned that specific V1a role triggers the goal)
- All goals reset for each Grand Tour

### Role Reference (from V1a)
| Role | Max slots |
|------|-----------|
| GC Leader | 1 |
| Sprinter | 1 |
| Climber | 1 |
| TT Specialist | 1 |
| Stage Hunter | 2 |
| Domestique | unlimited |

---

### 3.1 Ineos Grenadiers (GC + TT, nat: GB)

| # | Goal | Role | Reward | Tier group |
|---|------|------|--------|------------|
| 1 | Podium GC final | GC Leader | **150K** | A |
| 2 | Top 5 GC final | GC Leader | **75K** | A |
| 3 | Win an ITT | TT Specialist | **50K** | — |
| 4 | Wear maglia rosa | GC Leader | **50K** | — |
| 5 | Win a stage | All | **40K** | — |
| 6 | 2 riders in top 10 of an ITT | All | **25K** | — |

- Tier group A: **best of two** (top 3 → 150K, top 4-5 → 75K, top 6+ → 0)
- Goal #4: triggered when any squad rider holds maglia rosa for >=1 day, but role-gated to GC Leader for UI display
- **Max potential:** 315K (150 + 50 + 50 + 40 + 25)

---

### 3.2 Decathlon AG2R (GC + Sprint, nat: FR)

| # | Goal | Role | Reward | Tier group |
|---|------|------|--------|------------|
| 1 | Podium GC final | GC Leader | **150K** | A |
| 2 | Top 5 GC final | GC Leader | **75K** | A |
| 3 | Win a stage | Sprinter | **50K** | — |
| 4 | Wear maglia rosa | GC Leader | **50K** | — |
| 5 | Wear ciclamino | Sprinter | **40K** | — |
| 6 | Win a stage | All | **40K** | — |

- Tier group A: **best of two**
- Goals #3 and #6 **stack**: if Sprinter wins a stage → 50K (Sprinter) + 40K (All) = 90K
- Goal #5: triggered when Sprinter holds ciclamino (points jersey) for >=1 day
- **Max potential:** 330K (150 + 50 + 50 + 40 + 40)

---

### 3.3 Soudal Quick-Step (Sprint + Stage Hunter, nat: BE)

| # | Goal | Role | Reward | Tier group |
|---|------|------|--------|------------|
| 1 | Win points classification | Sprinter | **150K** | — |
| 2 | Win 2 stages | Sprinter | **75K** | B |
| 3 | 2 different riders win a stage | All | **75K** | — |
| 4 | Win a stage | Stage Hunter | **60K** | — |
| 5 | Win a stage | Sprinter | **50K** | B |
| 6 | Wear ciclamino | Sprinter | **50K** | — |

- Tier group B: **best of two** (2 stage wins → 75K, 1 stage win → 50K)
- **Max potential:** 410K (150 + 75 + 75 + 60 + 50)

---

### 3.4 Lidl-Trek (Sprint + Stage Hunter, nat: US/IT)

**Identical goals to Soudal Quick-Step.** Only the nationality changes (US/IT instead of BE).

| # | Goal | Role | Reward | Tier group |
|---|------|------|--------|------------|
| 1 | Win points classification | Sprinter | **150K** | — |
| 2 | Win 2 stages | Sprinter | **75K** | B |
| 3 | 2 different riders win a stage | All | **75K** | — |
| 4 | Win a stage | Stage Hunter | **60K** | — |
| 5 | Win a stage | Sprinter | **50K** | B |
| 6 | Wear ciclamino | Sprinter | **50K** | — |

- Tier group B: **best of two**
- **Max potential:** 410K (150 + 75 + 75 + 60 + 50)

---

## 4. T3 Sponsors — Specific Goals (DEFERRED)

T3 sponsors (Groupama, Movistar, Alpecin, Uno-X) keep base bonuses only (section 2).
Specific goals will be defined in a future iteration. No orientation split in base bonuses.

---

## 5. UI: Sponsor Card Component

The sponsor card is used in two places:
- **GT Team tab** → sponsor goals section
- **Budget page** → sponsor marketplace

### Card Layout (top to bottom)

1. **Header row**: Sponsor name (bold, left) + budget amount (Geist Mono, right) — same line
2. **Tags row** (below name): orientation tags (e.g. `GC` + `TT`) + nationality flag — all as highlighted tags (blue badge style), uniform appearance
3. **Base bonus (cumulative)** section:
   - Section header: `BASE BONUS (cumulative)` — uppercase, `--text-low`
   - 3 lines, compact (no spacing between lines):
     - Left: label in white/primary (`--text-high`), e.g. "Top 10 GC"
     - Right: reward amount in white, bold, Geist Mono (e.g. "+50K")
4. **Sponsor bonus (unique)** section — **T4+ only, hidden for T1/T2/T3**:
   - Section header: `SPONSOR BONUS (unique)` — uppercase, `--text-low`
   - 6 lines, same compact layout:
     - Left: goal label in white/primary (`--text-high`) + role in secondary color (`--text-mid`), same font size, no badge — just color difference
     - Right: reward amount in white, bold, Geist Mono
   - **Achieved goals**: full line gets strikethrough + reduced opacity (0.4)
5. **Nationality footer** (T3+ only, hidden for T1/T2):
   - Border top separator
   - Flag emoji + "British rider: all bonuses ×1.25"

### Design Tokens
- Section headers: `--type-label`, uppercase, `--text-low`
- Bonus labels: `--type-caption`, `--text-mid`
- Amounts: `--type-caption`, `--text-high`, `font-semibold`, Geist Mono, tabular-nums
- Role badges: use `Tag` component variant="highlighted"
- Achieved state: `line-through` + `opacity-50`
- Card: `--bg-surface`, `--border-default`, `--radius-lg`
- No spacing between bonus lines within a section (tight list)

---

## 6. Data Model

### Modified: `gt-goals.ts`

```typescript
export interface GtGoal {
  label: string;
  reward: number;
  role: "gc_leader" | "sprinter" | "climber" | "tt_specialist" | "stage_hunter" | null;
  tieredWith?: number; // index of the other tiered goal (best-of-two)
}
```

### Modified: `sponsors` table
- All T4 sponsors get identical `bonus_gc`, `bonus_one_day`, `bonus_stage` values (50K, 25K, 20K)
- All T3 sponsors get identical values (25K, 20K, 10K)
- Remove `×2` multiplier logic from `sponsor-bonus-card.tsx` and `sponsor-bonus-details.tsx`
- Update `×1.5` → `×1.25` in nationality display

### Modified: `sponsor-bonus-card.tsx` / `sponsor-bonus-details.tsx`
- Remove "if Grand Tour" / "if Monument" columns
- Remove "Multipliers" section (×2 row)
- Update ×1.5 → ×1.25
- Add "Sponsor bonus (unique)" section with role badges
- Add strikethrough state for achieved goals

### New: `sponsor_goal_completions` table (evaluation — ships with V1b)
- `id`, `team_id`, `sponsor_id`, `gt_slug`, `goal_index`, `completed_at`, `reward_paid`

---

## 7. Scope for Tonight (Giro ship)

Minimum to ship before Giro 2026-05-08:
1. Update `gt-goals.ts` with the 4 validated T4 sponsor goal sets
2. Update `GtGoal` interface to include `role` and `tieredWith`
3. Update `GtGoalsPreview` component to show role badges + new layout
4. Update base bonus amounts in DB migration (flat amounts, no ×2)
5. Update `sponsor-bonus-card.tsx`: remove ×2 columns, show flat amounts
6. Update nationality multiplier display: ×1.5 → ×1.25

**NOT in scope for tonight:**
- Goal evaluation/completion tracking (V1b future — manual for Giro)
- Strikethrough achieved state (needs evaluation system)
- T3 sponsor specific goals
- `sponsor_goal_completions` table
