# Phase Economy & Release Rider — Design Spec

**Date:** 2026-04-02
**Status:** Validated
**Related:** `docs/superpowers/specs/2026-04-02-sponsors-rework-design.md` (sponsors rework)
**Backlog items covered:** #2 Release Rider, #3 Daily Finance → Phase Finance, #4 Scoring adaptation, #5 Bankruptcy, #6 Auction Phase, #7 Phase Transition, partial #9 Pipeline

---

## 1. Core Principle — Phase-Based Economy

All financial operations are tied to **phases** (aligned with the WT calendar, 8 phases per season). There is no daily finance. Money moves at clear, predictable moments:

| Event | When | What happens |
|-------|------|-------------|
| **Payday** | When a player clicks "Confirm" at phase start | +sponsor budget, -salaries of current roster |
| **Auction won** | Round resolution (midnight CET) | -locked_salary of new rider, deducted immediately |
| **Race bonus** | Day of race results | +sponsor bonus, added immediately |
| **Release** | Anytime (player action) | -5K flat fee immediately, +transfer bonus if applicable |
| **Bankruptcy** | At payday, after salary deduction | Auto-release cascade if treasury < -10K |

### No Starting Treasury

New teams start with 0 treasury. The first action in the game is selecting a sponsor. Upon selection, the player receives their first sponsor payment immediately (counted as `sponsor_payment` in treasury_log). This replaces the old 200K starting fund.

---

## 2. Payday Mechanics

### Trigger
Payday is **not automatic**. It is triggered when the player clicks "Confirm" on the Phase Setup screen. This ensures all adjustments (sponsor change, releases, policy changes) are finalized before money moves.

### Sequence
1. Player adjusts config (sponsor, releases, policies) — no money moves yet
2. Player clicks "Confirm"
3. System calculates: `treasury += sponsor.monthly_budget - sum(locked_salary for active contracts)`
4. If treasury < -10K → bankruptcy cascade (see §6)
5. Player enters bidding mode

### First Phase (Onboarding)
- Player selects first sponsor → immediate payment (no confirm needed, this IS the confirmation)
- No salaries to deduct (empty roster)
- Player proceeds directly to bidding

### Timing
- Phase start dates are defined by the WT calendar
- The player can prepare their config anytime (even between phases)
- The "Confirm" button is only active once the phase has started
- Each player confirms independently — there's no global payday moment

---

## 3. Release Rider

### Rules
- A player can release a rider **at any time**
- **Flat fee: 5 000 EUR**, deducted immediately from treasury
- No salary refund (salary was already paid at payday)
- Rider returns to the recruitment pool immediately
- **Lock:** cannot release a rider recruited during the current phase's auction rounds

### Transfer Bonus
When releasing a rider, if the rider's current minimum salary (based on current PCS points) is higher than the locked_salary the player paid:

```
transfer_bonus = max(0, current_min_salary - locked_salary)
```

- `current_min_salary = max(5000, floor(pcs_points * 2000 / 12 / 100) * 100)` (standard formula)
- `locked_salary` = what the player actually paid in the auction
- Multiplier: **x1** (adjustable post-alpha)
- Net gain from release: `transfer_bonus - 5000` (flat fee)

### Treasury Log Entries
- Release fee: `type = 'release_fee'`, `amount = -5000`
- Transfer bonus: `type = 'transfer_bonus'`, `amount = +transfer_bonus` (only if > 0)

---

## 4. Sponsor Changes

### Rules
- 1 sponsor per team (unchanged from sponsors rework spec)
- Player can request a sponsor change **at any time**
- Change becomes **effective at the next payday** (next phase confirmation)
- During the current phase, the old sponsor remains active for:
  - Budget payments (already paid at payday)
  - Race bonuses (based on sponsor active at payday)
- Auto-assignment at onboarding: Lotto (T1) by default, player chooses

### Display
- Current sponsor clearly shown with "(active)" label
- If a change is pending: "Switching to [NewSponsor] next phase"

---

## 5. Policy Changes

### Rules
- Same timing as sponsors: **modifiable anytime, effective at next payday**
- Max active policies by level: 1 (L1-2) → 2 (L3-6) → 3 (L7-8)
- 4 policy types: Speciality (L1) → Nationality (L3) → Teams (L5) → Age (L7)
- No cooldown — the phase boundary IS the cooldown

### Unified Rule
Sponsors and policies follow the exact same rule: **change anytime, effective next payday**. This is the single rule players need to learn.

---

## 6. Bankruptcy

### Trigger
At payday (confirmation), after `treasury += sponsor_budget - salaries`:
- If `treasury >= -10_000` → no action (tolerance buffer)
- If `treasury < -10_000` → bankruptcy cascade

### Cascade
1. Identify the rider with the **highest cumulative XP** on the team
2. Release this rider:
   - Contract set to `released`
   - Salary refunded: `treasury += locked_salary`
   - Release fee applied: `treasury -= 5000`
   - Transfer bonus applied if applicable
3. Check treasury again
4. If still < -10K → repeat with next highest XP rider
5. Continue until treasury >= -10K or roster is empty

### Treasury Log
- Each auto-release generates: `type = 'bankruptcy_release'`
- Plus the standard release_fee and transfer_bonus entries

---

## 7. Recruits Page — 2 States

The Recruits tab (`/league/[id]/team/recruits`) has two states based on whether the player has confirmed for the current phase.

### Navigation (constant across all states)
```
Team tab bar:  My Team | Recruits | History
```

History shows past auction results with: **Phase name + Round number + Date** (e.g., "Phase 4 Giro · Round 1 · 3 April").

### State 1 — Phase Setup (pre-confirmation)

Shown when the player has NOT yet confirmed for the current phase. Also shown between phases (with confirm button disabled).

```
┌─────────────────────────────────────────┐
│  Phase 4 — Giro              3d 14h     │
│                                         │
│  Rounds                                 │
│  R1: 3 Apr · R2: 7 Apr · R3: 11 Apr    │
│  [Edit dates]  ← Race Director only     │
│                                         │
│  ───────────────────────────────────    │
│                                         │
│  Sponsor: Groupama-FDJ      [Change]    │
│  Budget: +450 000 EUR                   │
│                                         │
│  ───────────────────────────────────    │
│                                         │
│  My Roster (7 riders)                   │
│  ┌──────────────────────────────────┐   │
│  │ Pogacar      85 000 EUR [Release]│   │
│  │ Evenepoel    72 000 EUR [Release]│   │
│  │ Van Aert     65 000 EUR [Release]│   │
│  │ ...                              │   │
│  └──────────────────────────────────┘   │
│  Total salaries: -210 000 EUR           │
│                                         │
│  ───────────────────────────────────    │
│                                         │
│  Policies (2/2 active)                  │
│  ├ Nationality: France     [Change]     │
│  └ Specialty: GC           [Change]     │
│                                         │
│  ───────────────────────────────────    │
│                                         │
│  FORECAST                               │
│  Treasury now:     145 000 EUR          │
│  + Sponsor:       +450 000 EUR          │
│  - Salaries:      -210 000 EUR          │
│  = After payday:   385 000 EUR          │
│                                         │
│  [ Confirm & Start Bidding ]            │
│    (disabled if phase not started yet)  │
└─────────────────────────────────────────┘
```

**Race Director extras:**
- `[Edit dates]` button next to rounds — opens date pickers for R1/R2/R3
- Only available **before** the phase start date (WT calendar). Once the phase start date is reached, dates are locked for all players.

**Between phases:**
- Same screen, same interactivity (can change sponsor, release, policies)
- "Confirm" button is disabled with text: "Phase starts [date]"
- Countdown timer shows time until phase start

### State 2 — Bidding (post-confirmation)

Standard recruitment interface. Shown after the player has confirmed.

```
┌─────────────────────────────────────────┐
│  Round 1                    2d 14h      │
│  Budget: 385 000 EUR                    │
│                                         │
│  [Filter chips: All | GC | Sprint | ...]│
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ Rider 1 │ │ Rider 2 │ │ Rider 3 │  │
│  │ card    │ │ card    │ │ card    │   │
│  └─────────┘ └─────────┘ └─────────┘  │
│  ...                                    │
│                                         │
│  [Sticky bar: X bids · total Y EUR]    │
└─────────────────────────────────────────┘
```

---

## 8. Auction Mechanics (unchanged except timing)

- Sealed-bid auction, up to 3 rounds per phase
- Round dates set by Race Director (before phase start)
- Resolution: GitHub Actions cron at 00:05 CET (daily check)
- Winning bid → rider assigned to team, `locked_salary` deducted immediately from treasury
- Salary deduction is a `treasury_log` entry of type `auction_purchase`

---

## 9. Pipeline Impact

### Modified Pipelines
- **monthly_finance.py** → **REMOVED**. Replaced by payday at confirmation (handled in-app via server action, not Python pipeline)
- **scoring.py** → Remove `rider_revenue` calculation (`max(0, pts × 1500 - salary)`). Replace with sponsor bonus calculation (per sponsors rework spec). XP calculation unchanged.
- **resolve_current_round()** → Add immediate salary deduction for auction winners

### New Server Actions (Next.js)
- `confirmPhaseSetup()` — triggers payday: sponsor payment + salary deduction + bankruptcy check
- `releaseRider()` — updated: flat fee + transfer bonus + immediate effect (remove notice/phase logic)
- `changeSponsor()` — sets pending sponsor (effective next phase)
- `changePolicy()` — sets pending policy (effective next phase)
- `setRoundDates()` — Race Director only, before phase start

### Unchanged Pipelines
- **init-riders** — no change
- **post-race** — adds sponsor bonuses (per sponsors rework spec), XP unchanged
- **enrich-riders** — no change
- **startlists** — no change
- **auction resolution** — minor change (immediate salary deduction)

---

## 10. Database Changes

### Contracts Table
- **Remove:** `notice_date`, `release_date`, `effective_phase_id`, `status = 'notice'`
- **Keep:** `id`, `team_id`, `rider_id`, `locked_salary`, `status` (only 'active' or 'released'), `purchased_at`, `last_salary_paid`
- **Add:** `released_at` (timestamp, null until released)
- **Add:** `phase_recruited_id` (to enforce lock: can't release in same phase as recruitment)

### Treasury Log
- **Add types:** `release_fee`, `transfer_bonus`, `bankruptcy_release`
- **Remove types:** `monthly_salary`, `monthly_bonus` (replaced by payday entries)
- **Add type:** `payday_salary` (bulk salary deduction at confirmation)
- **Keep:** `sponsor_payment`, `auction_purchase`, `starting_fund` (renamed context: first sponsor payment)

### Teams Table
- **Add:** `phase_confirmed_at` (timestamp, null = not yet confirmed for current phase)
- **Add:** `pending_sponsor_id` (FK to sponsors, null = no change pending)
- **Keep:** `treasury`, `cumulative_xp`, `level`

### Team Policies Table
- **Add:** `pending` (boolean, default false). At payday confirmation, pending=true policies become active (pending=false) and previously active policies of the same type are deleted.

### Auction Rounds Table
- **Add:** Race Director can set `start_date` and `end_date` per round (if not already editable)

### Remove
- `team_sponsors.first_phase_budget`, `payments_count`, `slot`, `status`, `pending_sponsor_id`, `effective_phase_id` (already planned in sponsors rework)
- `contracts.notice_date`, `contracts.release_date`, `contracts.effective_phase_id`

---

## 11. Constants Summary

| Constant | Value | Notes |
|----------|-------|-------|
| Starting treasury | 0 EUR | First sponsor payment replaces old 200K |
| Release flat fee | 5 000 EUR | Fixed, applies to voluntary + bankruptcy releases |
| Transfer bonus multiplier | x1 | Adjustable post-alpha |
| Bankruptcy tolerance | -10 000 EUR | Treasury can go this negative without cascade |
| Salary formula | `max(5000, floor(pts * 2000 / 12 / 100) * 100)` | Unchanged |
| Sponsor change timing | Next phase payday | Not immediate |
| Policy change timing | Next phase payday | Same as sponsor |
| Auction round resolution | 00:05 CET daily | GitHub Actions cron |

---

## 12. Edge Case: Player Never Confirms

If a player does not confirm for a phase:
- They **cannot bid** in any auction round (gate enforced)
- Their existing riders **still earn race bonuses** (based on the sponsor active from last payday)
- Their existing riders **still earn XP** from race results
- At the next phase, they must confirm both the skipped phase's payday AND the new one (or we auto-confirm with no changes — TBD based on alpha feedback)

---

## 13. Removal Checklist

Things explicitly removed by this design:

- [ ] Starting treasury (200K) — replaced by first sponsor payment
- [ ] Monthly finance pipeline — replaced by payday at confirmation
- [ ] Contract notice status — release is immediate
- [ ] Contract effective_phase_id — no more phase-delayed effects
- [ ] Rider revenue bonus (`pts × 1500 - salary`) — replaced by sponsor bonuses
- [ ] Policy cooldown — phase boundary replaces cooldown
- [ ] Phase transition logic (`applyPhaseTransition`) — no more pending→active transitions
- [ ] CONVERSION_RATE env var — no longer used for rider revenue (sponsor bonuses have their own rates)
