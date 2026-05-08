# Market & My Bids — Design Spec

**Date:** 2026-04-02
**Status:** Draft — pending user review

---

## 1. Problem Statement

Users place bids on multiple riders from the Recruts page, then want to do a final adjustment pass — tweaking amounts up/down across all pending bids before the round closes. Today this requires navigating to each rider's detail page individually, which is slow and frustrating.

Secondary issues surfaced during brainstorming:
- "Recruts" is misspelled and semantically wrong (implies direct hire, not bidding)
- The Age filter in Recruts is broken (no birthdate in query → groups all as "Unknown")
- Rider detail bid section has UX noise ("No active round" text, inconsistent layout vs Market)
- SegmentedControl used inconsistently across pages (Market filters should be pills, not segments)

---

## 2. Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Feature location | Option C — "My Bids" pill filter inside Market | Same page, same mental model. No empty nav tab. Reuses existing StickyBar + bid logic |
| Rename | "Recruts" → **"Market"** | Universal gaming term (FIFA, Fantasy). Short, clear, correct English |
| Filter component | Scrollable **pills** (not SegmentedControl) | More natural scroll, fits 6 items (All, Teams, Spec, Nat, Age, My Bids), matches tag aesthetic |
| My Bids card layout | **3-line card** with stepper `[−] [input] [+]` | Optimized for adjustment (not initial placement). Stepper faster than typing for ±500€ tweaks |
| Desktop behavior | Main panel owns all editing; Detail Rail is informational only (when from My Bids) | Avoids dual-editing conflict. User adjusts multiple bids in main, checks rider stats in rail |
| Rider Detail bid cleanup | Remove "No active round", use StickyBar, min salary under input | Consistency with Market. Less noise |
| Step increment | **500€** per +/− click | Good balance for 5k–50k salary range |
| Age filter fix | **2 groups only**: ≤23 years (Young Blood) and >32 years (Road Warriors) | Matches the two Age policies. Simple, actionable grouping |

---

## 3. Rename: Recruts → Market

### Scope
- Route: `/league/[id]/team/recruts/` → `/league/[id]/team/market/`
- Sub-route: `/league/[id]/team/recruts/history` → `/league/[id]/team/market/history`
- Component files: `recruts-client.tsx` → `market-client.tsx`
- All `?from=recruts` search params → `?from=market`
- BackHeader label: "Recruts" → "Market"
- Bottom nav / sidebar labels
- BACK_LABELS in rider-detail-client.tsx

### Not in scope
- No URL redirects from old routes (pre-alpha, no users)

---

## 4. Market Filters — Pills

### Current state
`SegmentedControl` component with options: All, Teams, Speciality, Nationality, Age

### New state
Scrollable horizontal pills row. Each pill is a `<button>` with pill styling (radius-pill, border, caption type).

**Pills list:** `All` · `Teams` · `Speciality` · `Nationality` · `Age` · `My Bids (N)`

- **My Bids pill**: accent/highlighted style when active. Shows count badge `(N)` of active bids. Hidden or shows `(0)` when no bids.
- **Scroll**: horizontal overflow with `overflow-x-auto`, no scrollbar (`scrollbar-none`). Drag/swipe on mobile.
- The SegmentedControl component remains in the codebase — it's still used in Rider Detail and Ranking pages.

### Age filter fix
Currently broken (line 188 of recruts-client.tsx: `// Age filter — no birthdate available yet`).

**Fix:** Pass `birthdate` from the server query to the client. Group into exactly 2 categories:
- **Young Talents** (≤ 23 years) — matches `young_blood` policy
- **Veterans** (> 32 years) — matches `road_warriors` policy
- Riders between 24–32 are shown in both groups? **No** — they don't match either age policy, so they appear under a third group "24–32 years" or are simply excluded from the Age view. **Decision: show all 3 groups** (Young ≤23, Mid 24–32, Veterans >32) so no riders disappear, but the policy-relevant groups are named to match.

---

## 5. My Bids View — Card Layout

When the `My Bids` pill is active, the rider list switches to a different card layout optimized for bid adjustment.

### Section title
Above the cards: **"Your active bids"** in `--type-section` / `--text-mid`.

### Card structure (3 lines per rider)

```
┌──────────────────────────────────────────────┐
│         Tadej Pogačar 🇸🇮 ▲12                │
│  48px   UAE Team Emirates · GC               │
│  photo  [−]    [ 42,500 € ]    [+]        › │
│                 min 38,200 €                 │
└──────────────────────────────────────────────┘
```

**Line 1:** Full name + nationality flag + MovementTag (pcs_rank_diff)
**Line 2:** Real team name · Specialty
**Line 3:** Stepper row: `[−]` button, input field (centered, mono font), `[+]` button, chevron `›`

**Photo:** 48px avatar (larger than standard 36px rider-card), spans all 3 lines via `row-span` or flex alignment. PCS rank badge below avatar as usual.

**Min salary line:** Appears below the stepper in `--type-micro` / `--text-ghost`. Visible when the input has focus or contains a value. Hidden otherwise (saves vertical space when not editing).

**Chevron `›`:** Right edge of line 3. On mobile → navigates to rider detail (`?from=mybids`). On desktop → opens Detail Rail via RailLink.

### Stepper behavior
- **Step:** 500€ per click on `[+]` or `[−]`
- **Min floor:** Cannot go below `minSalary` (rider's `pcs_points_1yr × 2000 / 12`, floored to 100)
- **Input field:** Also directly editable (user can type a custom amount). Validated on save (multiple of 100, ≥ minSalary)
- **[−] button disabled** when amount = minSalary
- **Visual:** Input border becomes accent color when value differs from saved value (unsaved indicator)

### Component approach
New component: **`BidAdjustCard`** (not a variant of RiderCard).

Reason: RiderCard is entirely wrapped in `RailLink` — clicking anywhere navigates. BidAdjustCard needs interactive inputs inside the card, so only the chevron is a link. The layout is also fundamentally different (3 lines + stepper vs 2 lines + right content). A separate component is cleaner than adding conditional branches to RiderCard.

### StickyBar
Same StickyBar component as current Recruts, shown at bottom of the My Bids view:
- Left: `{currentSlots + activeBids}/{maxSlots} slots`
- Center: `{formatThousands(treasury - totalBidAmount)} €`
- Right: `SAVE` button (disabled when no unsaved changes)

### Save behavior
Same as current Recruts: compares local `bids` state vs `savedBids` state. On save, calls `placeBid()` for modified bids, `cancelBid()` for removed bids. Shows `beforeunload` warning if unsaved changes.

### Empty state
When no active bids: show centered message "No active bids — browse the market to place your first bid" with a link/button back to the "All" pill.

---

## 6. Rider Detail — Bid Section Cleanup

### Changes (context = "recruts" / "market")

1. **Remove "No active round" text** (line 303-306 of rider-detail-client.tsx). The disabled/opacity state is sufficient.

2. **Step increment: 100€ → 500€** on the `[+]` and `[−]` buttons (lines 314, 352).

3. **Min salary display:** Remove from MetricBox grid. Instead, show below the bid input in `--type-micro` / `--text-ghost` (same pattern as My Bids cards). Visible when input has focus or contains a value.

4. **Replace inline budget display + "Save bid" button with StickyBar.** The current layout has:
   - `{slots}/{max} slots · {budget} €` (text line)
   - Full-width "Save bid" button
   - "Remove bid" link

   Replace with:
   - StickyBar at bottom: slots | budget | Save button
   - "Remove bid" stays as a text link above the StickyBar (or below the stepper)

5. **MetricBox grid** (context "recruts"): With min salary moved, the 3 boxes become: **Game XP | Bonus | PCS Points** (replacing the now-redundant "Min. Salary" box with something useful).

### Rider Detail in Rail — from My Bids context

When rider detail opens in the Detail Rail with `?from=mybids`:
- **Hide the entire bid section** (stepper, save button, StickyBar)
- **Show min salary as read-only text** in the MetricBox grid (not editable)
- Rationale: editing happens in the main panel's My Bids view. Showing bid controls in the rail too would create conflicting state.

Implementation: add prop `hideBidSection?: boolean` to `RiderDetailClient`. Set to `true` when `context === "market"` AND `inRail === true` AND search param `from=mybids`.

### Rider Detail in Rail — from Market (non My Bids) context

When opened from the standard Market browse views (All, Teams, etc.):
- **Show full bid section** as usual (stepper + StickyBar in rail)
- This is the existing behavior, just with the cleanup above applied

---

## 7. Desktop Responsive

### Architecture (unchanged)
```
Sidebar 180px │ Main (flex:3) │ Detail Rail (flex:2, min 380px)
```

### Behavior by scenario

**Market "All/Teams/Spec/Nat/Age" + click rider:**
- Main: Market list with inline bid inputs (existing compact cards)
- Rail: Rider detail WITH bid section (full stepper + StickyBar in rail)
- Clicking RiderCard → RailLink opens rail (existing behavior)

**Market "My Bids" + click chevron:**
- Main: My Bids list with BidAdjustCards (stepper inputs, StickyBar at bottom of main)
- Rail: Rider detail WITHOUT bid section (informational only — stats, startlists, rankings, min salary read-only)
- Only the chevron `›` is a RailLink (rest of card is interactive, not a link)

**My Team / Ranking + click rider:**
- Existing behavior unchanged

### Key technical detail
In `BidAdjustCard`, the card is NOT wrapped in `RailLink`. Only the chevron button uses RailLink:
```
<div className="bid-adjust-card">
  {/* photo, name, team, stepper — all interactive, no link wrapper */}
  <RailLink href={`/league/${leagueId}/rider/${riderId}?from=mybids`}>
    <ChevronRight />
  </RailLink>
</div>
```

---

## 8. Component Patterns — Consistency Rules

### Pills (new filter component)
- Used in: **Market** filters, **Budget** transaction filters
- Style: `radius-pill`, `border border-[--border-default]`, `--type-caption`, `bg-transparent` default, `bg-[--bg-surface-active] text-[--text-high]` when active
- Scrollable horizontal row, `overflow-x-auto scrollbar-none`
- Interactive (clickable) — radius-pill is OK here per design system (pills are small touch targets, decorative radius is appropriate)

### SegmentedControl (existing)
- Used in: **Rider Detail** (PCS Stats / Game Stats tabs), **Ranking** page tabs
- Full-width container with border, mutually exclusive options
- Keep as-is

### Tags (existing, non-interactive)
- Used in: specialty badges, age badges, status indicators
- `radius-pill`, non-clickable `<span>`

---

## 9. Backlog Items

These items should be tracked for implementation:

| # | Item | Priority | Notes |
|---|------|----------|-------|
| 1 | Rename Recruts → Market (routes, components, labels, search params) | P0 | Prerequisite for everything else |
| 2 | Replace SegmentedControl with scrollable pills in Market | P0 | New filter-pills component |
| 3 | Fix Age filter (pass birthdate, 3 groups: ≤23, 24–32, >32) | P1 | Currently broken, all riders show as "Unknown" |
| 4 | Add My Bids pill + BidAdjustCard component | P0 | Core feature of this spec |
| 5 | Market My Bids view: StickyBar, save flow, empty state | P0 | Reuses existing bid logic |
| 6 | Rider Detail: remove "No active round", step 500€, min salary under input | P1 | Cleanup, consistency |
| 7 | Rider Detail: replace inline budget/save with StickyBar | P1 | Consistency with Market |
| 8 | Rider Detail in Rail: hide bid section when from=mybids | P1 | Avoids dual-editing conflict |
| 9 | BidAdjustCard: only chevron is RailLink (not whole card) | P0 | Required for desktop interactivity |

---

## 10. Out of Scope

- History tab placement (user deferred to separate spec)
- Ranking page pill conversion (separate task)
- Notification system
- Budget page filters (already uses pills — no change needed)
