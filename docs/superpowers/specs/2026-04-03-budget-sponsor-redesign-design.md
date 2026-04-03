# Budget Page & Sponsor Marketplace Redesign — Design Spec

**Date:** 2026-04-03
**Status:** Validated
**Branch:** `feature/budget-sponsor-redesign`
**Context:** Improve readability of the budget page P&L and sponsor marketplace bonus display. Based on research in `docs/research/2026-04-03-fantasy-economics-research.md`.

---

## 1. Budget Page (`/league/[id]/budget`)

### 1.1 Phase Navigator

- **No future phases:** Right chevron disabled (opacity 30%, no click) when `phaseIndex >= currentPhaseIndex`. Only backward navigation allowed.
- **Full-width layout:** Chevrons at far left/right edges, phase label centered. Unchanged from current.
- **Reduced gap:** `mt-1` (4px) between phase nav and treasury card (was `mt-2`).

### 1.2 Treasury + P&L Card (replaces Balance Hero)

Uses the existing brand gradient card (`xp-card-body`).

```
┌─ brand gradient card ──────────────────────┐
│ TREASURY (label, uppercase, text-low)      │
│ 425,000 €  (display, cyan, Geist Mono)     │
│                                            │
│ Sponsor          +250,000 €                │
│ Bonuses           +45,000 €                │
│ Salaries         -180,000 €                │
│ ─────────────────────────────              │
│ Phase result     +115,000 €  (bold)        │
└────────────────────────────────────────────┘
```

**Data sources:**
- Treasury = `team.treasury` (cumulative)
- Sponsor = `currentSponsor.monthly_budget`
- Bonuses = `income - sponsorBase` (race bonuses = total income minus sponsor payment)
- Salaries = `phaseSalaries` (sum of active `contracts.locked_salary`)
- Phase result = sponsor + bonuses - salaries

**Styling:**
- All amounts in white (`--text-high`), Geist Mono, `tabular-nums`
- No green/red coloring
- Labels in `--text-mid`, `--type-caption`
- Phase result label in `--text-high`, font-weight 600

### 1.3 Bankruptcy Warning Banner

Shown only when `phaseSalaries > currentSponsor.monthly_budget`:

```
⚠ Bankruptcy risk — your salaries exceed your sponsor income
```

- Below the treasury card, `mt-2`
- Red tint background (`bg-red-500/8`), red border (`border-red-500/30`), red text
- No red stroke on the treasury card itself

### 1.4 Sponsor Section

Section header unchanged: "Sponsor" (type-section, text-high) + "Change →" link (caption, accent).

**Sponsor card — collapsed single line:**
```
[▼] Groupama-FDJ [GC] 🇫🇷          450K €  ▼
```

- `ChevronDown` from Lucide (same icon family as rest of app)
- Rotates 180deg when expanded
- Name + orientation Tag + nationality flags + amount — all on one line
- Card style: `bg-surface`, `border-default`, `radius-lg`
- Expand reveals `SponsorBonusDetails` (existing component, unchanged for now)

### 1.5 Transactions Section

Unchanged. Section header: "Transactions" + "See all →". Filter chips + transaction rows.

**Note:** Transaction list will be empty until the phase economy job is implemented (see `docs/TODO_FOLLOWUP_AUCTIONS.md` item #16).

### 1.6 Section Spacing

- Phase nav → Treasury card: `mt-1` (4px)
- Treasury card → Sponsor section: `mt-6` (24px)
- Sponsor section → Transactions section: `mt-6` (24px)
- Matches spacing pattern used in My Team page.

---

## 2. Sponsor Marketplace (`/league/[id]/budget/marketplace`)

### 2.1 Tier Labels

Single line: `TIER 3 · LEVEL 3` — uppercase, `--type-caption` (12px), `--text-low`, weight 600.
Lock icon 🔒 on tier label only (not on individual cards) for locked tiers.

### 2.2 Sponsor Card Structure

Each sponsor is a card with expand/collapse:

**Collapsed (single line):**
```
(○) Groupama-FDJ [GC] 🇫🇷          450K €  ▼
```

**Active state:** Cyan 2px stroke on entire card + filled radio button.

**Locked state:** Entire card at 40% opacity. Radio disabled. No lock icon on the card (lock is on tier label). Still has chevron but non-expandable.

**Layout:**
- Radio button: far left
- Name + tags + flags: after radio
- Amount + ChevronDown: far right (`ml-auto`)
- ChevronDown from Lucide, rotates 180deg when open

### 2.3 Bonus Display — Tiers 1-4 (Two-Column System)

Content indented past radio button (aligned with sponsor name).

**Section title:** "BASE BONUS" — uppercase, `--type-label`, `--text-low`, followed by a divider line.

**Grouping rule:** GC-focused sponsors show GC + Stage first, then divider, then One-Day. One-Day-focused sponsors show One-Day first, then divider, then GC + Stage.

**Two-column amounts per row:**

```
GC Top 15       +20K    if Grand Tour  +40K
Stage Top 5      +5K    if Grand Tour  +10K
───────────────────────────────────────────
One-Day Top 15   +5K    if Monument    +10K
```

- Left label: `--type-caption`, `--text-mid`
- Base amount (`+20K`): Geist Mono, `--type-label` (11px), `--text-low` — positioned close to the left label
- "if Grand Tour" / "if Monument": `--type-label` (10px), `--text-low` — collé (right next to) the enhanced amount
- Enhanced amount (`+40K`): Geist Mono, 13px, font-weight 600, `--text-high` (white) — aligned far right

**Nationality multiplier:** Separate line at bottom with border-top divider:
```
🇫🇷 French rider: all bonuses ×1.5
```

### 2.4 Bonus Display — Tiers 5-6 (Current Format + Grouping)

Keep current single-column format. Add divider between stage race group and one-day group.

**Section title:** "PRESTIGE BONUS" instead of "BASE BONUS".

```
Podium Grand Tour GC              +25K
Victory Stage (Grand Tour)        +15K
Victory Stage (stage race)        +15K
─────────────────────────────────────────
Podium Monument                   +25K
Victory One-Day                   +25K
```

- Single column: label left, amount right (white, Geist Mono)
- No base/enhanced split (T5-T6 have explicit prestige amounts, not multiplied)
- No nationality multiplier (T5-T6 don't have one)

### 2.5 Expand/Collapse Behavior

- Only one card expanded at a time (accordion) — or allow multiple? **Decision: allow multiple** (simpler, lets user compare).
- Locked cards: not expandable.
- Active card: starts collapsed (user can expand to review).

---

## 3. Implementation Status

### Already implemented (budget page):
- [x] Treasury + P&L card (brand gradient)
- [x] Phase nav: no future phases (`maxIndex` prop)
- [x] ChevronDown on sponsor card
- [x] Sponsor single line (name + tag + flags + amount)
- [x] Bankruptcy warning banner
- [x] Section spacing (mt-1, mt-6)
- [x] Typecheck passes

### To implement (sponsor marketplace):
- [ ] Refactor `marketplace-client.tsx`: card structure with radio + single-line header
- [ ] Active state: cyan 2px stroke
- [ ] Locked state: opacity 40%, no lock on card
- [ ] Tier labels: single line format
- [ ] New `SponsorBonusGrid` component for T1-T4 two-column layout
- [ ] Grouping logic: GC-focused vs One-Day-focused ordering
- [ ] "if Grand Tour" / "if Monument" labels collé to enhanced amounts
- [ ] T5-T6: keep single column + add group dividers
- [ ] Section title: "BASE BONUS" / "PRESTIGE BONUS" with divider
- [ ] Nationality multiplier note at bottom
- [ ] ChevronDown from Lucide (not ▾ character)
