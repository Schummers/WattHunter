# Budget & Sponsor Pages Redesign — Design Spec

**Date:** 2026-04-03
**Status:** Validated
**Scope:** Sponsor Marketplace page redesign + Budget page sponsor card + Transaction filters cleanup

---

## 1. Sponsor Marketplace — Full Redesign

### 1.1 Structure — Tier Grouping

Sponsors are grouped by tier. Each tier has a **section header** followed by sponsors separated by full-width dividers.

**Section header:**
- Left: "Tier N" — `--type-section` (16px/600), `text-high`
- Right: "Lv. N" — `--type-section` (16px/600), `text-low`
- Bottom: `border-subtle` 1px divider
- Spacing: `--space-5` (20px) between last sponsor of a tier and next tier header

**Inter-sponsor dividers:**
- `border-subtle` 1px, full-width (edge to edge of container)
- Between sponsors within the same tier

### 1.2 Sponsor Row — Two-Line Layout

Each sponsor is displayed on two lines:

**Line 1:**
- Left: Chevron (`ChevronRight` 14px, rotates 90° when expanded) + Sponsor name (`--type-emphasis` 14/600, `text-high`)
- Right: (empty on line 1, toggle is on line 2)

**Line 2:**
- Left: Orientation tag + Nationality flag tag(s)
- Right: Budget amount (`--type-stat-small` mono 16/700, `text-high`) + Switch toggle

**Tags:**
- Orientation: `Tag highlighted` — "GC", "One-Day", or "neutral"
- Nationality: `Tag default` — flag emoji(s), e.g. "🇫🇷", "🇧🇪🇳🇱"
- T1-T2 and T6 (no nationality): only orientation tag shown

**Locked sponsors (tier not unlocked):**
- Entire row: `opacity: 0.4`
- Switch toggle replaced by Lock icon (🔒)
- Row still clickable to expand (can preview bonuses)

### 1.3 Expanded State — Bonus Details

When a sponsor row is expanded, bonus details appear directly below line 2 (no card wrapper).

**Section "BASE BONUS":**
- Label: `--type-label` (12px/700), uppercase, `tracking-wide`, `text-low`
- Bonus lines: threshold label left (`--type-body` 14/400, `text-mid`), amount right (`--type-body` mono 14/500, `text-high`)
- All amounts right-aligned on the same column as the budget amount above
- Threshold format: "Top 15 — GC", "Top 5 — Stage", "Victory — Monument"

**For T1-T4 (non-explicit prestige):**
```
BASE BONUS
Top 15 — GC ························ +20K
Top 15 — One-Day ···················· +5K
Top 5  — Stage ······················ +5K
```

**For T5-T6 (explicit prestige — `has_explicit_prestige: true`):**
```
BASE BONUS
Top 5  — One-Day ··················· +25K
Top 3  — Monument ·················· +75K
Top 5  — Stage Race GC ············· +25K
Top 3  — Grand Tour GC ············· +75K
Victory — Stage ···················· +15K (×2 GT)
```

**Section "MULTIPLIERS" (T1-T4 only):**
- Label: `--type-label` (12px/700), uppercase, `tracking-wide`, `text-low`
- Always show `×2 Monuments & Grand Tours` for ALL T1-T4 sponsors (current bug: only shown when `bonus_monument > bonus_one_day`)
- Show `×1.5 for riders 🇫🇷` when sponsor has nationality (T3-T4)
- Multiplier badges: mono font, `bg-app`, `border-default`, small padding

**T5-T6 do NOT show a MULTIPLIERS section** — their prestige amounts are explicit in the bonus lines.

### 1.4 Interaction Model

**Click row → expand/collapse:**
- Clicking anywhere on the sponsor row (except the toggle) expands or collapses the bonus details
- Chevron rotates 90° on expand
- No separate "View Bonus Objectives" button

**Switch toggle → select sponsor:**
- Clicking the Switch selects this sponsor and auto-deselects the previous one
- Only one sponsor can be ON at a time
- Auto-save: no Save button, no sticky bar
- On toggle → server action `saveSponsor()` fires immediately

**Confirmation banner (top of page):**
- Shown after a sponsor is selected via toggle
- Style: same pattern as policies page
- Green banner (`emerald border/bg`): "✓ [Sponsor Name] — changes applied" (if during auction window / immediate)
- Amber banner (`amber border/bg`): "⏳ [Sponsor Name] — active from [Phase Name]" (if pending next phase)
- Banner disappears on next toggle action

**Default expanded state:**
- Sponsors in the **highest unlocked tier** → expanded by default on page load (e.g. level 4 → T3 is highest unlocked since T4 requires level 5)
- All other tiers → collapsed
- User can manually expand/collapse any sponsor

### 1.5 Removed Elements

- ❌ Radio circle indicators (replaced by Switch toggle)
- ❌ "View Bonus Objectives" expand button
- ❌ Sticky bar with "Save →" button
- ❌ Card wrapper around bonus details
- ❌ "Current" tag (the ON state of the switch is sufficient)

---

## 2. Budget Page — Sponsor Card Redesign

### 2.1 Collapsed State (default)

The sponsor section on the budget page uses a standard card (`bg-surface`, `border-default`, `radius-lg`) with a slim two-line layout:

```
┌──────────────────────────────────────┐
│ ▸ Groupama-FDJ                 450K  │  ← line 1: chevron + name + budget (mono)
│   [GC] [🇫🇷]                         │  ← line 2: orientation + nationality tags
└──────────────────────────────────────┘
```

**Tokens:**
- Card: `bg-surface`, `border-default`, `radius-lg` (8px), `--space-4` padding
- Name: `--type-emphasis` (14/600), `text-high`
- Budget: `--type-stat-small` mono (16/700), `text-high`, right-aligned
- Tags: same as marketplace (Tag highlighted for orientation, Tag default for flags)
- Chevron: `ChevronRight` 14px, `text-low`

### 2.2 Expanded State (on click)

Clicking the card expands it to show bonus objectives inside the same card:

```
┌──────────────────────────────────────┐
│ ▾ Groupama-FDJ                 450K  │
│   [GC] [🇫🇷]                         │
│                                      │
│   BASE BONUS                         │
│   Top 15 — GC ················ +20K  │
│   Top 15 — One-Day ··········· +5K   │
│   Top 5  — Stage ············· +5K   │
│                                      │
│   MULTIPLIERS                        │
│   [×2] Monuments & Grand Tours       │
│   [×1.5] for riders 🇫🇷              │
└──────────────────────────────────────┘
```

Same bonus format as marketplace. Amounts aligned on the same column.

### 2.3 No Sponsor Selected

When no sponsor is selected, show the existing CTA:

```
┌──────────────────────────────────────┐
│   Select a sponsor →                 │  ← accent-default, centered
└──────────────────────────────────────┘
```

### 2.4 Section Header

- Left: "Sponsor" — `--type-section` (16/600), `text-high`
- Right: "Change →" — `--type-caption`, `accent-default`, link to marketplace

---

## 3. Transaction Filters — Type Cleanup

### 3.1 Active Transaction Types

These are the only types currently written to `treasury_log`:

| Type | Written by | Category | Description |
|------|-----------|----------|-------------|
| `sponsor_payment` | `budget/actions.ts`, `market/actions.ts` | Sponsors | Sponsor income at phase confirmation |
| `sponsor_bonus` | `sponsor_bonus.py` | Bonuses | Race result bonus |
| `transfer_bonus` | `rider/[riderId]/actions.ts` | Bonuses | Plus-value when releasing appreciated rider |
| `payday_salary` | `market/actions.ts` | Salaries | Bulk salary deduction at phase confirmation |
| `auction_purchase` | `auction.py` | Salaries | First month salary on auction win |
| `release_fee` | `rider/[riderId]/actions.ts`, `market/actions.ts` | Salaries | Flat fee when releasing a rider |
| `bankruptcy_release` | `market/actions.ts` | Salaries | Salary refund during bankruptcy auto-release |

### 3.2 Legacy Types (no longer written)

Keep in CHECK constraint for existing data, but remove from frontend filters:

| Type | Replaced by |
|------|------------|
| `starting_fund` | No initial treasury (sponsor is first income) |
| `monthly_salary` | `payday_salary` |
| `phase_salary` | `payday_salary` |
| `daily_salary` | Never written |
| `phase_sponsor_base` | `sponsor_payment` |
| `daily_sponsor_base` | Never written |
| `rider_revenue` | `sponsor_bonus` |
| `monthly_bonus` | `sponsor_bonus` |

### 3.3 Corrected Filter Groups

Apply to both `budget-client.tsx` and `transactions-client.tsx`:

```typescript
const FILTER_OPTIONS = [
  { label: "All" },
  { label: "Bonuses" },
  { label: "Salaries" },
  { label: "Sponsors" },
];

function filterTransactions(transactions: Transaction[], filterIndex: number): Transaction[] {
  if (filterIndex === 0) return transactions;
  if (filterIndex === 1) return transactions.filter((t) =>
    ["sponsor_bonus", "transfer_bonus"].includes(t.type));
  if (filterIndex === 2) return transactions.filter((t) =>
    ["payday_salary", "auction_purchase", "release_fee", "bankruptcy_release"].includes(t.type));
  if (filterIndex === 3) return transactions.filter((t) =>
    ["sponsor_payment"].includes(t.type));
  return transactions;
}
```

### 3.4 TransactionRow — New Type Handling

Add display logic for the 3 missing active types in `transaction-row.tsx`:

| Type | Avatar | Name | Subtitle |
|------|--------|------|----------|
| `payday_salary` | Rider photo (if `rider_id`) or "SAL" circle | Rider name or "Phase salaries" | "Salary" |
| `release_fee` | Rider photo (if `rider_id`) or "REL" circle | Rider name | "Release fee" |
| `transfer_bonus` | Rider photo (if `rider_id`) or "TR" circle | Rider name | "Transfer bonus" |

### 3.5 Rider Photo in TransactionRow

When a transaction has a `rider_id`, show the rider's PCS photo instead of initials circle:

- Server component: join `riders(photo_url, last_name, first_name)` via `rider_id` in treasury_log query
- TransactionRow: new prop `riderPhotoUrl?: string`
- If `riderPhotoUrl` exists: `<img>` in 32×32 rounded-full instead of initials circle
- Fallback: initials circle (current behavior)

---

## 4. Multiplier Bug Fix

### Current bug
In `marketplace-client.tsx`, the ×2 multiplier for Monuments/Grand Tours is only shown when:
```typescript
sponsor.bonus_monument != null && sponsor.bonus_monument > sponsor.bonus_one_day
```
This is wrong — T1-T4 don't have `bonus_monument` set (it's null), so the multiplier never shows for them.

### Fix
For non-explicit-prestige sponsors (`has_explicit_prestige === false`), ALWAYS show "×2 Monuments & Grand Tours" in the MULTIPLIERS section. The ×2 multiplier applies to ALL T1-T4 sponsors regardless of their bonus_monument field.

```typescript
// BEFORE (wrong)
const showMultipliers = !sponsor.has_explicit_prestige && 
  (nationalityFlag || (sponsor.bonus_monument != null && sponsor.bonus_monument > sponsor.bonus_one_day));

// AFTER (correct)
const showMultipliers = !sponsor.has_explicit_prestige;
// Always show ×2 line for T1-T4, and ×1.5 line if nationality exists
```

---

## 5. Files to Modify

| File | Change |
|------|--------|
| `apps/web/app/(game)/league/[leagueId]/budget/marketplace/marketplace-client.tsx` | Full rewrite: tier grouping, Switch toggle, expand/collapse, auto-save, banner |
| `apps/web/app/(game)/league/[leagueId]/budget/budget-client.tsx` | Sponsor card: slim 2-line with expand + fix filter types |
| `apps/web/app/(game)/league/[leagueId]/budget/transactions/transactions-client.tsx` | Fix filter types (same as budget-client) |
| `apps/web/app/(game)/league/[leagueId]/budget/page.tsx` | Join rider photo in treasury_log query |
| `apps/web/components/transaction-row.tsx` | Add `payday_salary`, `release_fee`, `transfer_bonus` handling + rider photo prop |
| `apps/web/lib/sponsors.ts` | May need helpers for tier grouping |
