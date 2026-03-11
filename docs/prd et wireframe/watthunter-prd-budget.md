# PRD — Budget Page & Sponsor Marketplace

**Product:** WattHunter · Fantasy Cycling
**Version:** v3.0 Design System
**Author:** Jonathan Schummers + Claude
**Date:** 2026-03-09
**Status:** Draft
**Wireframes:** `watthunter-budget-wireframe.html`, `watthunter-budget-marketplace.html`, `watthunter-budget-transactions.html`

---

## Problem Statement

The Budget page is the financial nerve center of WattHunter — where players track income (bonuses, sponsorships), outgoing costs (salaries), and manage their sponsor relationships. Currently the page lacks structure: transactions are flat and undifferentiated, sponsor management is buried in settings, and there's no period-based view aligned with the auction phase system. Players can't quickly answer "How much did I earn this phase?" or "Should I switch sponsors before next phase?".

**Who is affected:** All active players interact with the budget. Strategic players (Lv.5+) who manage multiple sponsors and plan transfers around phase transitions are most impacted.

**Impact of not solving:** Players make uninformed transfer decisions (overspending), miss sponsor optimization opportunities, and the game's economic layer feels opaque rather than strategic. Sponsor switching — a key engagement lever — is underutilized because it's not surfaced at the right moment.

---

## Goals

1. **Make the budget scannable in 3 seconds** — balance, income, outgoing visible immediately with no scrolling
2. **Align budget view with auction phases** — replace calendar months with game phases (The Flandrians, Giro d'Italia, etc.) as the primary time dimension
3. **Surface sponsor management inline** — sponsor cards with conditions, tier info, and "Change sponsor" CTA directly on the Budget page
4. **Enable informed sponsor switching** — marketplace sub-page with tier comparison, condition tags, and budget impact preview before confirmation
5. **Provide full transaction history** — filterable, grouped by month, with phase-level navigation and monthly totals

---

## Non-Goals

- **Transfer market / rider signing flow** — separate feature; Budget only shows the financial impact of transfers, not the signing UX
- **Budget forecasting / projections** — future feature (P2); v1 shows actuals only
- **Multi-currency or salary negotiation** — all values in € (game credits), fixed by game rules
- **Desktop/tablet layout** — mobile-first only (390px); responsive is a future phase
- **Sponsor gameplay balancing** — tier thresholds, amounts, and conditions are fixed; this PRD covers UX only
- **Notification system for phase transitions** — separate initiative (push notifications)

---

## User Stories

### As a casual player
- I want to see my current balance at a glance so that I know if I can afford a transfer
- I want to see my recent transactions so that I understand where my money comes from and goes
- I want to understand which phase I'm in so that I know when sponsor payments arrive

### As a strategic player
- I want to filter transactions by type (bonuses, salaries, sponsors) so that I can analyze my income sources
- I want to see all transactions for a specific phase so that I can evaluate my phase performance
- I want to compare sponsors before switching so that I choose the one with the best conditions for my roster
- I want to see the budget impact of switching sponsors before I confirm so that I don't make a mistake
- I want to know when a sponsor change takes effect so that I can time my decisions around phase transitions

### As a leveling-up player
- I want to see locked sponsor tiers and their requirements so that I have a financial roadmap
- I want to understand what each sponsor tier brings (amount, conditions) so that I know what to aim for

---

## Requirements

### P0 — Must-Have

**Budget main page:**

| # | Requirement | Acceptance Criteria |
|---|-------------|-------------------|
| BU-1 | Phase-based period navigation at top | Phase name centered (e.g., "The Flandrians"), date range below (e.g., "Mar 1 – Apr 12"). Left/right arrows to navigate between phases. First phase: left arrow disabled. Current phase: right arrow disabled. |
| BU-2 | Balance hero section with income/outgoing | "BALANCE" label uppercase 10px/700 text-low. Balance value in cyan-400 Geist Mono 34px/900. Income and Outgoing on same row below, both in text-high (NOT colored — +/− signs distinguish direction). |
| BU-3 | Transactions section with "See all →" link | Section header "Transactions" + "See all →" link (cyan-500). Shows last 4 transactions for current phase. Tap "See all" navigates to full transaction history. |
| BU-4 | Filter chips: All / Bonuses / Salaries / Sponsors | Contained Light pattern (DS v3.0). Default: All. Filters apply to visible transactions only. Active chip: bg-surface-active + text-high/600. |
| BU-5 | Transaction rows with 3 distinct types | **Bonus:** rider avatar (initials) + rider name + race name + amount + date. **Salary:** rider avatar + rider name + "Salary" + amount + date. **Sponsor:** sponsor logo (abbreviation, bg-surface-active) + sponsor name + "Sponsorship" + amount + date. All amounts in text-high Geist Mono 14px/700. +/− prefix only (no color). |
| BU-6 | Sponsor cards section (full-width, vertical) | Each active sponsor: logo circle (44px) + name + tier label (e.g., "Main · T3") + amount (Geist Mono 18px/800) + "/month" + condition tags (pill radius, border-default) + "Change sponsor →" link (cyan-500). |
| BU-7 | Locked sponsor slots at reduced opacity | Locked slots: 40% opacity, dashed border logo, name = "Main sponsor slot", tier = "Unlocks at Level X · min €Xk/month", lock tag with level. Not tappable. |
| BU-8 | Bottom navigation with Budget active | 4 items: Home, Team, Budget (active, cyan-500), Ranking. 10px labels. |

**Sponsor Marketplace sub-page:**

| # | Requirement | Acceptance Criteria |
|---|-------------|-------------------|
| MK-1 | Back navigation "← Budget" | Back arrow + "Budget" text in text-mid. Tappable, returns to Budget main page. No bottom nav page tabs on this sub-page (bottom nav remains). |
| MK-2 | Page title with sponsor slot context | "MAIN SPONSOR" label (uppercase, text-low). "Choose a sponsor" title 20px/700. Subtitle shows available tiers: "T3 · T4 · T5 — from Level 5". |
| MK-3 | Info banner about phase timing | Neutral banner (bg-surface, border-default): "Change will take effect at the next phase." Always visible. |
| MK-4 | Sponsor list grouped by tier | Each tier section: header with tier label + amount + level requirement. Sponsors listed below with: logo, name, condition tags (pill), amount. Current sponsor marked with cyan-500 border on logo + checkmark. |
| MK-5 | Sponsor selection interaction | Tap a sponsor row → selected state (cyan-500 left border + cyan background tint + checkmark). Only one selection at a time. Selecting current sponsor deselects (no change). |
| MK-6 | Locked tiers with level requirement | Locked sponsors at 35% opacity, dashed logo border. Tier header shows "🔒 Lv.X". Not tappable. |
| MK-7 | Sticky CTA with budget preview | Only visible when a NEW sponsor is selected (not current). Shows "New monthly budget: €X / month" + "Switch to [Sponsor Name] →" CTA button (gradient cyan). CTA hidden when no selection or current sponsor selected. |

**All Transactions sub-page:**

| # | Requirement | Acceptance Criteria |
|---|-------------|-------------------|
| TX-1 | Back navigation "← Budget" | Same pattern as Marketplace. |
| TX-2 | Phase-based period navigation | Same as Budget main page. Navigating changes the transaction list to show that phase's transactions. |
| TX-3 | Filter chips: All / Bonuses / Salaries / Sponsors | Same Contained Light pattern. Filters apply across all visible months. |
| TX-4 | Transactions grouped by month | Month header: "MARCH 2026" (uppercase, text-low) + monthly net total (text-high, Geist Mono 12px/700). Transactions listed chronologically within each month. |
| TX-5 | Full transaction rows | Same 3-type pattern as Budget main page (BU-5). All transactions for the selected phase, not capped at 4. |
| TX-6 | Bottom navigation | Same as Budget main page. |

### P1 — Nice-to-Have

| # | Requirement | Notes |
|---|-------------|-------|
| P1-1 | Sponsor condition tags with match indicator | Show how many of your current riders match each sponsor condition (e.g., "2× 🇫🇷 ✓" if you have 2 French riders). Helps compare sponsors. |
| P1-2 | Transaction amount animation on filter change | Numbers fade/slide when switching between All/Bonuses/Salaries/Sponsors. Subtle, not distracting. |
| P1-3 | Balance comparison vs. previous phase | Small delta below balance: "↑ €312k vs. The Ardennes". Cyan-400 if positive, text-low if negative. Only shown when previous phase data exists. |
| P1-4 | Sponsor change confirmation dialog | Before switching: bottom sheet with "Switch from [Current] to [New]?" + impact summary (budget change, conditions gained/lost). Prevents accidental switches. |
| P1-5 | Pull-to-refresh on transaction list | Standard pull gesture refreshes transaction data. Loading skeleton state. |

### P2 — Future Considerations

| # | Requirement | Notes |
|---|-------------|-------|
| P2-1 | Budget forecasting | Project income/outgoing for next phase based on current roster + sponsors. Separate data model needed. |
| P2-2 | Transfer budget alerts | "You can afford X more riders at average cost" surfaced on Budget page. Requires roster valuation API. |
| P2-3 | Sponsor performance tracking | "Soudal Quick-Step earned you €X in bonuses this season" — tracks how sponsor conditions translate to actual bonus income. |
| P2-4 | Export transactions to CSV | Download button on All Transactions page. Low priority but useful for engaged players. |
| P2-5 | Multi-phase comparison view | Side-by-side budget comparison across 2-3 phases. Requires dashboard-style layout (desktop first). |

---

## Success Metrics

### Leading indicators (change within 2 weeks)

| Metric | Target | Stretch | Measurement |
|--------|--------|---------|-------------|
| Budget page visits per session | >1.5 visits/session | >2.0 | Page view analytics |
| Sponsor marketplace opens | 30% of Lv.5+ players open marketplace | 50% | Navigation tracking |
| Filter chip usage | >20% of Budget visits use a filter | >35% | Click tracking on filter chips |
| "See all" tap rate | >15% of Budget visits tap "See all" | >25% | Click tracking |
| Sponsor switch completion rate | >60% of marketplace visitors who select a sponsor complete the switch | >75% | Funnel: select → confirm |

### Lagging indicators (change within 1–2 months)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Sponsor switching frequency | +40% sponsor changes per phase vs. current | Backend: sponsor change events / phase / player |
| Transfer decision quality | −15% budget overdrafts (spending more than balance) | Backend: failed transfer attempts due to insufficient funds |
| Budget page time on page | 20-40 seconds average (not too short = useless, not too long = confusing) | Time on page analytics |
| Feature satisfaction | >4.0/5 in next survey | In-app survey post-launch |

---

## Design Specifications

### Color System Rules (v3.0)

| Token | Usage on Budget pages |
|-------|----------------------|
| `--cyan-400` (accent-highlight) | Balance hero value only (1 hero stat per screen) |
| `--cyan-500` (accent-default) | "See all →" action, "Change sponsor →" link, bottom nav active, filter chip border on hover, marketplace selected state |
| `--text-high` | ALL transaction amounts (+/−), sponsor names, rider names, balance stats, month totals |
| `--text-low` | Labels ("BALANCE", "Income", "Outgoing"), dates, transaction metadata, tier labels, condition tags text |
| `--text-mid` | Back header text, info banner text, sponsor tier description |
| `--bg-surface` / `--border-default` | Sponsor cards, info banner, filter chip container |
| `--bg-surface-active` | Sponsor logo backgrounds, active filter chip, marketplace selected row tint |

**Critical rule:** No colored amounts. All transaction values in `--text-high`. The +/− prefix is the only income/outgoing distinction. This keeps the page calm and data-dense.

### Transaction Card Anatomy

3 types, consistent row layout (avatar 40px + info + amount right-aligned):

| Type | Avatar | Name | Subtitle | Amount prefix |
|------|--------|------|----------|--------------|
| **Bonus** | Rider initials (WV, TP, JA) in circle, bg-surface | Rider last name + first initial | Race name (e.g., "Paris-Roubaix") | + |
| **Salary** | Same rider initials, same circle style | Rider last name + first initial | "Salary" | − |
| **Sponsor** | Sponsor abbreviation (SQS, GRP), bg-surface-active | Sponsor full name | "Sponsorship" | + |

Date always right-aligned below amount, 10px text-low.

### Sponsor Card Anatomy (Budget main page)

| Element | Token | Spec |
|---------|-------|------|
| Logo | 44px circle, bg-surface-active, border-default | 3-letter abbreviation, 12px/800 |
| Name | `--text-high`, 14px/600 | Sentence case |
| Tier | `--text-low`, 12px | "Main · T3" or "Secondary · T2" |
| Amount | `--text-high`, Geist Mono 18px/800 | "€550k" right-aligned |
| Period | `--text-low`, 10px | "/ month" below amount |
| Condition tags | `--text-mid`, 10px/600 | Pill radius (20px), border-default. Contains: flag multiplier, specialty, result condition |
| Change link | `--cyan-500`, 12px/600 | "Change sponsor →" |

### Sponsor Marketplace — States

| State | Visual | Interaction |
|-------|--------|-------------|
| **Available** | Standard row, no highlight | Tappable → selected state |
| **Current** | Cyan-500 border on logo, checkmark badge | Tappable → deselects (removes CTA) |
| **Selected (new)** | Cyan-500 left border (3px), cyan tint background, checkmark | Tappable → deselects. Shows CTA. |
| **Locked** | 35% opacity, dashed logo, lock emoji in tier header | Not tappable |

### Auction Phases Reference

| # | Label | Dates |
|---|-------|-------|
| 1 | Season Start | Jan 1 – Feb 28 |
| 2 | The Flandrians | Mar 1 – Apr 12 |
| 3 | The Ardennes | Apr 13 – May 10 |
| 4 | Giro d'Italia | May 11 – Jun 14 |
| 5 | Tour de France | Jun 15 – Aug 2 |
| 6 | La Vuelta | Aug 3 – Sep 21 |
| 7 | End of Season | Sep 22 – Nov 2 |

Period navigation uses phase boundaries, not calendar months. The period selector wraps around: after Phase 7, next season's Phase 1 (if applicable). Arrow buttons disabled at boundaries (first/last phase of current season).

### Sponsor Tiers Reference

| Tier | Monthly budget | Unlock level | Conditions (examples) |
|------|---------------|-------------|----------------------|
| T1 | €200k | Lv.1 | Basic (1 nationality, 1 specialty) |
| T2 | €350k | Lv.3 | 2 conditions (nationality + specialty or result) |
| T3 | €550k | Lv.5 | 3 conditions (nationality multiplier + specialty + result) |
| T4 | €750k | Lv.7 | 3 conditions (premium) |
| T5 | €1M | Lv.8 | Top-tier (GC policy + monument/GT result) |

Sponsors within a tier all have the same monthly amount. They differ by conditions (nationality bonus, specialty match, result thresholds).

---

## Open Questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| OQ-1 | Can a player have 0 sponsors? Or is at least 1 required at all times? | Product / Game Design | Yes — affects empty state design |
| OQ-2 | When exactly does a sponsor switch take effect? Start of next phase, or next calendar month within the phase? | Product / Backend | Yes — affects info banner wording and timing logic |
| OQ-3 | Do sponsor conditions (nationality multiplier, result threshold) stack with policies? Or are they independent bonuses? | Game Design | No — but affects how we explain conditions in the UI |
| OQ-4 | Should the "All Transactions" view span across phases (full season) or reset per phase? Currently spec'd as per-phase with nav. | Product | No — can adjust post-launch |
| OQ-5 | Is there a maximum number of sponsor slots? The mockup shows 2 active + 1 locked. Is it always Main + Secondary + (optional higher tier)? | Game Design | Yes — affects locked slot display logic |
| OQ-6 | Should salary amounts be shown per rider or per month (aggregate)? Current mockup shows per-rider rows. | Product | No — per-rider is richer data |
| OQ-7 | Do we need a "cancel pending sponsor change" option, or is it final once confirmed? | Product | No — can add as P1 if needed |

---

## Timeline Considerations

- **Hard dependency:** v3.0 design system tokens + component library (Underline Tabs, Filter Chips, Tags) must be implemented before Budget page work begins
- **Prerequisite:** My Team, Progression, Policies pages (current PRD) should ship first — they establish the patterns Budget reuses
- **Phasing suggestion:** Budget main page (BU-1 to BU-8) → All Transactions (TX-1 to TX-6) → Marketplace (MK-1 to MK-7) → P1 items
- **Phase timing:** Sponsor switching is tied to phase transitions. Feature should ideally ship at the start of a new phase for clean testing.
- **API requirements:** 2 new endpoints needed: (1) transaction list with type filter + phase filter, (2) sponsor marketplace with tier/lock data + switch confirmation

---

## Implementation Notes

- All text in **English**
- Mobile-first (390px), no desktop-specific layout
- Typography: Geist Sans for UI, Geist Mono for ALL numbers with `tabular-nums`
- Transaction amounts: `--text-high` always, +/− prefix only, no color distinction
- Phase navigation: fetch phase list from API, current phase determined server-side
- Sponsor logo: 3-letter abbreviation derived from sponsor name (configurable server-side)
- Sponsor conditions: stored as structured data (type + value + threshold), rendered as pill tags client-side
- Filter chips: client-side filtering (no API call on filter change — all transactions loaded for current phase)
- Marketplace: selection state is ephemeral (not persisted until CTA confirmation)
- Marketplace CTA: POST to sponsor-switch endpoint → server validates level/tier access → returns success or error
- Locked states: all level-gating computed server-side, sent as `is_locked: true` + `unlock_level: X` in API response
- Sponsor card "Change sponsor →" link: navigates to Marketplace with sponsor slot context (main vs. secondary)
- Monthly totals on All Transactions: computed client-side from loaded transactions
