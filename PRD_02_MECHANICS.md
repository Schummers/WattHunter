# PRD 02 — Game Mechanics
## Cycling Fantasy Game MVP

**Version:** 3.0
**Date:** 21 février 2026
**Author:** Jonathan Schummers
**Read alongside:** PRD_01_OVERVIEW.md · PRD_03_TECHNICAL.md

---

## Two Core Indicators

Every team has exactly two independent indicators. They do not directly affect each other, but both are needed to win.

| Indicator | What it is | What it drives |
|-----------|-----------|----------------|
| **Team Score (XP)** | Accumulated XP from rider performances × policy multipliers | League ranking + team level + unlocks |
| **Treasury (€)** | Cash balance: inflows − outflows | Ability to buy riders at auction |

> **How they interact strategically:** A high treasury lets you buy better riders → better riders generate more XP → higher score. But overpaying at auctions depletes treasury → can't buy next month. Finding undervalued riders (low salary, high PCS output) is the central skill.

---

## 1. Rider Universe

### Volume
- **~923 professional riders** tracked (WorldTour + ProTeam 2026)
  - **383 ProTeam riders** — 16 teams, min 20 riders/team
  - **~540 WorldTour riders** — 18 teams, ~30 riders/team

### Per-Rider Data (stored in DB)

| Field | Type | Description |
|-------|------|-------------|
| `first_name` | string | — |
| `last_name` | string | — |
| `nationality` | string | ISO 3166-1 alpha-2 (FR, BE, SI, …) |
| `real_team` | string | UCI team code + name |
| `team_type` | enum | `ProTeam` / `WorldTour` |
| `photo_url` | string | Profile photo from PCS |
| `age` | int | Current age in years |
| `specialty` | enum | `climber` / `sprinter` / `rouleur` / `puncheur` / `time_trialist` / `all_rounder` |
| `pcs_points_rolling_1y` | int | PCS points over rolling 365 days |
| `pcs_rank` | int | PCS individual ranking position |
| `min_salary_monthly` | int | Calculated salary in €/month (see §2) |

### Rider Access Tiers (by player level)

The catalogue shown during auctions is filtered by player level. A ProTeam rider is **always accessible** regardless of their individual PCS rank.

| Level | Accessible Riders |
|-------|-------------------|
| 1 | ProTeam only (~383 riders) |
| 2 | ProTeam + PCS rank 400 or lower (i.e., rank ≤400) |
| 3 | ProTeam + PCS rank ≤300 |
| 4 | ProTeam + PCS rank ≤200 |
| 5 | ProTeam + PCS rank ≤150 |
| 6 | ProTeam + PCS rank ≤100 |
| 7 | ProTeam + PCS rank ≤50 |
| 8 | ProTeam + PCS rank ≤30 |
| 9 | ProTeam + PCS rank ≤16 |
| 10 | ALL riders (~923) |

> **ProTeam rule:** If a ProTeam rider reaches top-10 PCS ranking, they remain accessible to Level 1 players. The ProTeam flag overrides rank-based gating.

> **Already-recruited riders:** If a rider is already owned by another player in the same league, they appear greyed out in the catalogue (not biddable).

---

## 2. Economy System

### 2.1 Treasury

- **Starting treasury:** **500,000€** per new team
- Treasury = running sum of all inflows and outflows
- Displayed permanently in app header: `Treasury: €245,000`

#### Inflows
| Source | Timing |
|--------|--------|
| Starting treasury | At team creation |
| Sponsor contract payments | Monthly (1st of month), prorated for partial months |
| Rider profitability revenue | Daily (updated after each PCS data refresh) |

#### Outflows
| Source | Timing |
|--------|--------|
| Rider salaries | Monthly (1st of month) for all current roster members |
| Auction winning bids | Deducted immediately when auction resolves |

### 2.2 Salary Formula

Salaries are based on **PCS rolling 365-day points** (simpler and directly available from procyclingstats).

```
Annual salary = (PCS_1yr / 1000) × 500,000€
Monthly salary = Annual salary / 12

Floor: 5,000€/month (riders with few or no PCS points)
Cap:   300,000€/month (top-ranked riders)
```

**Example table:**

| PCS Points (1yr) | Annual Salary | Monthly Salary |
|-----------------|---------------|----------------|
| 100 pts | 50,000€ | 4,167€ → **floor: 5,000€** |
| 500 pts | 250,000€ | 20,833€ |
| 1,000 pts | 500,000€ | 41,667€ |
| 2,000 pts | 1,000,000€ | 83,333€ |
| 4,000 pts | 2,000,000€ | 166,667€ |
| 7,200+ pts | 3,600,000€+ | → **cap: 300,000€** |

**Salary recalculation:** Salaries are recalculated **before each monthly auction** based on PCS rolling 365 days at that date. A rider who had a great year last season will become more expensive; a rider in bad form gets cheaper. This creates trading opportunities.

**Fallback:** If PCS 365-day data is unavailable for a rider, use the displayed PCS rank to estimate (linear interpolation from rank vs. known salaries).

**Contract salary vs. market salary:** When a player wins a rider at auction, the rider's **salary is locked** at the market salary at auction time. It does not change while the rider is on the player's team. If the player releases and re-auctions the rider, the new salary uses the recalculated market rate.

### 2.3 Rider Profitability

```
Monthly revenue per rider = PCS_points_gained_this_month × CONVERSION_RATE
Monthly profit per rider  = Monthly revenue − Contract salary
```

- `PCS_points_gained_this_month` = current PCS points − PCS points 30 days ago
- `CONVERSION_RATE` = **TBD — placeholder: 500€/PCS point** (must be calibrated via Excel simulation)
  - Target: a rider at average ProTeam salary (~20,000€/mo) with average monthly points should generate a small positive profit, so the economy is viable over 6 months
- If monthly profit < 0 → deducted from treasury
- Revenue is credited/debited **daily** (proportional to points gained that day)

**Dashboard display per rider:**
```
Salary: 20,833€/mo | Revenue: 25,000€/mo | Profit: +4,167€/mo
```

**No inflation for MVP:** Conversion rate is fixed for the full season. Adjust in V2 if needed.

### 2.4 Bankrupt State

If a player's treasury is insufficient to cover salaries on the 1st of the month:

1. **Month 1 — Grace period:** Player is put in "debt" status. All salary amounts are still deducted (treasury goes negative). Player is **blocked from bidding** in auctions but can continue to play.
2. **Month 2 — Auto-release:** If treasury is still negative at the start of the next month, **riders auto-release, most expensive salary first**, until treasury would be positive after next month's salaries. Released riders re-enter the general pool (available in next auction).
3. **Recovery:** Player can continue playing with remaining riders and must wait for next auction to rebuild.

**UI:** Show clear "⚠️ BANKRUPT" badge on team header when in debt state. Show countdown to auto-release date.

---

## 3. Scoring System

### 3.1 Daily Score Calculation

```
XP gained by rider today = PCS_points_gained_today × (1 + Σ active policy bonuses applicable to rider)
Team daily XP            = Σ XP gained by all riders in roster
```

**Policy bonuses are additive.** If a rider qualifies for 2 active policies, both bonuses apply.

Example:
```
Rider: Belgian sprinter, 27 years old
Active policies: National Pride (Belgium) +5%, Specialist (Sprinter) +5%
PCS points today: 100
XP gained = 100 × (1 + 0.05 + 0.05) = 110 XP
```

### 3.2 Cumulative Team Score

```
Cumulative XP = Σ all daily XP since team creation
```

This cumulative XP drives:
1. **League ranking** — Sorted by cumulative XP (highest first, real-time)
2. **Team level** — When cumulative XP crosses a threshold, team levels up

### 3.3 Score vs. Treasury Independence

- XP and Treasury are **independent**: having more money does not give you more XP directly
- XP is earned only through rider race performance × policies
- Treasury only affects what riders you can afford to recruit (indirect link)

---

## 4. Level & Progression System

### 4.1 The 10 Levels

Target: reach Level 10 in ~6 months of active play. Thresholds are estimates; recalibrate once real PCS data is available.

| Level | XP to Reach Level | Cumulative XP | Slots | Active Policies | Sponsor Tier |
|-------|-------------------|---------------|-------|-----------------|--------------|
| 1 | — (start) | 0 | 6 | 0 | None |
| 2 | 5,000 XP | 5,000 | 6 | 0 | None |
| 3 | 7,000 XP | 12,000 | 7 | **1** | **Tier 1** |
| 4 | 9,800 XP | 21,800 | 7 | 1 | Tier 1 |
| 5 | 13,720 XP | 35,520 | 8 | 1 | **Tier 2** |
| 6 | 19,208 XP | 54,728 | 9 | **2** | Tier 2 |
| 7 | 26,891 XP | 81,619 | 10 | 2 | **Tier 3** |
| 8 | 37,648 XP | 119,267 | 11 | 2 | Tier 3 |
| 9 | 52,707 XP | 171,974 | 12 | 2 | **Tier 4** |
| 10 | 73,790 XP | 245,764 | 12 | **3** | **Tier 5** |

> XP thresholds use a ×1.4 multiplier between levels. These are starting estimates — recalibrate after Excel simulation with real PCS data.

### 4.2 Level Up Behaviour

- Level up triggers immediately when cumulative XP threshold is crossed
- **Notification + celebration animation** sent to player
- New slots, policies, and sponsor tier unlocked immediately
- Player must manually choose new policy / switch to new sponsor (not auto-applied)

---

## 5. Policies System

### 5.1 Policy Slot Unlock Rules

| Level | Active Policy Slots |
|-------|---------------------|
| 1–2 | 0 (no policies) |
| 3–5 | 1 policy active |
| 6–9 | 2 policies active |
| 10 | 3 policies active |

- Players choose which policies to activate from the 5 available types
- Unused slots stay empty (no default policy)
- Policies can be swapped at any time (no cooldown for MVP)
- Each policy slot can hold one active policy

### 5.2 The 5 Policy Types

All policies apply a **+5% XP bonus** to qualifying riders.

---

#### Policy 1 — Young Blood
**"+5% XP for each rider under 23 years old"**

- Applies to: all riders in your roster who are **< 23 years old** at time of calculation
- No configuration needed (automatic based on age field)
- Age is checked daily; if a rider turns 23, the bonus no longer applies from that day

---

#### Policy 2 — Road Warriors
**"+5% XP for each rider over 30 years old"**

- Applies to: all riders in your roster who are **> 30 years old** at time of calculation
- No configuration needed (automatic based on age field)

---

#### Policy 3 — National Pride
**"+5% XP for all riders of your chosen nationality"**

- **Configurable:** Player picks one nationality (e.g., Belgium, France, Slovenia)
- Applies to: all riders in your roster whose `nationality` matches the chosen value
- Player can change the nationality setting at any time (change takes effect next daily calculation)
- Display: "National Pride — 🇧🇪 Belgium (+5%)"

---

#### Policy 4 — Team Chemistry
**"+5% XP for all riders from your chosen real-life team"**

- **Configurable:** Player picks one real-life UCI team (e.g., Visma–Lease a Bike, Quick-Step)
- Applies to: all riders in your roster from the chosen `real_team`
- Player can change the team at any time (change takes effect next daily calculation)
- Display: "Team Chemistry — Visma–Lease a Bike (+5%)"

---

#### Policy 5 — Specialist
**"+5% XP for all riders with your chosen specialty"**

- **Configurable:** Player picks one specialty: `climber` / `sprinter` / `rouleur` / `puncheur` / `time_trialist`
- Applies to: all riders in your roster whose `specialty` matches
- Player can change the specialty at any time
- Display: "Specialist — 🏔️ Climbers (+5%)"

---

### 5.3 Policy Stacking Example

A rider can benefit from multiple active policies simultaneously:
```
Rider: Tadej Pogacar — Slovenian, Climber, 25 years old, UAE Team Emirates
Active policies: National Pride (Slovenia) + Specialist (Climber) + Young Blood (<23 → age 25 → NOT applicable)
Bonus: +5% + +5% = +10%
PCS points today: 200 → XP gained: 200 × 1.10 = 220 XP
```

---

## 6. Sponsors System

### 6.1 Overview

Sponsors provide cash injections into the treasury on a contractual basis. They are a key tool to maintain positive cash flow when rider profitability alone isn't sufficient.

**Rules:**
- Maximum **1 active sponsor contract** at a time
- Sponsor contracts last **2 months**
- At contract expiry, player can choose a new sponsor from available tiers (or renew same tier)
- Cannot change sponsor mid-contract (only at expiry)
- Sponsor tier is limited by team level (see table in §4.1)

### 6.2 Sponsor Tiers & Options

At each tier, the player chooses between **two options**: one unconditional (lower payment), one conditional (higher payment but requires roster conditions to be met).

If conditions are not met at payment time, player receives only the unconditional amount. Conditions are checked on the 1st of each month.

| Tier | Level Unlock | Option A — Unconditional | Option B — Conditional | Condition |
|------|-------------|--------------------------|------------------------|-----------|
| **1** | Level 3 | **80,000€** over 2 months | **120,000€** over 2 months | ≥3 riders of the same nationality in roster |
| **2** | Level 5 | **170,000€** over 2 months | **220,000€** over 2 months | ≥2 riders under 23 years old |
| **3** | Level 7 | **250,000€** over 2 months | **300,000€** over 2 months | ≥2 riders of the same specialty |
| **4** | Level 9 | **400,000€** over 2 months | **500,000€** over 2 months | ≥3 riders from the same real-life team |
| **5** | Level 10 | **800,000€** over 2 months | **1,000,000€** over 2 months | ≥4 riders same nationality OR ≥3 from same real-life team |

### 6.3 Payment Schedule

```
Sponsor monthly payment = Contract total / 2  (paid 1st of each month, over 2 months)

Example: Tier 1 Option A (80,000€ / 2 months) → 40,000€ paid on month 1, 40,000€ on month 2
```

### 6.4 Condition Checking

Conditions are evaluated **on payment day** (1st of each month):
- If condition is met → full Option B payment credited
- If condition is not met → player receives Option A amount instead (no penalty, no retroactive adjustment)
- Condition failure is shown: "Condition not met this month — received 40,000€ instead of 60,000€"

### 6.5 Sponsor Lifecycle

```
[Level up to 3] → Sponsor selection screen appears
Player picks Tier 1 Option A or B
2-month contract starts on next 1st of month
Month 1: payment credited
Month 2: payment credited → contract expires
→ Player prompted to select new sponsor (can pick same tier or higher if leveled up)
```

---

## 7. Auction System

### 7.1 Auction Calendar

Auctions are **not strictly monthly** — they are pre-scheduled for the season to align with Grand Tour start dates, ensuring players can recruit riders before major points opportunities.

**General rule:** An auction window opens approximately 2 weeks before each Grand Tour or major block of classics. Additional monthly windows fill the gaps.

**Example season calendar (2026):**

| Auction # | Opens | Closes | Context |
|-----------|-------|--------|---------|
| 0 — Pre-season | Mid-February | End February | Season launch |
| 1 | ~1 week before Paris-Nice | 3 days after open | Spring Classics block |
| 2 | ~1 week before Giro d'Italia | 3 days after open | Giro preparation |
| 3 | Mid-June | 3 days after open | Fill gap |
| 4 | ~1 week before Tour de France | 3 days after open | Tour preparation |
| 5 | ~1 week before Vuelta | 3 days after open | Vuelta preparation |
| 6 | September | 3 days after open | End-of-season |

> Commissioner (league admin) sees the full calendar. Auctions open automatically; commissioner can push back an opening by max 48h if needed.

### 7.2 Auction Rules

- **Duration:** 72 hours per auction window
- **Simultaneous bidding:** All players bid simultaneously on any available rider
- **Minimum bid:** Rider's `min_salary_monthly` in euros (cannot bid below floor salary)
- **Bid increment:** Minimum +100€ above previous highest bid
- **Budget validation:** If `sum of all active bids > current treasury`, the bid is rejected with a clear error: "Insufficient budget — your total active bids would exceed your treasury"

### 7.3 Auction Resolution (Auto, at T=0)

When the auction window closes, resolution runs automatically:

1. For each rider, the highest bid wins
2. **Tie-breaking:** If two players bid the same amount, the **first bid placed** (earlier timestamp) wins
3. **Budget cascade check:** After all winners are determined, verify each winner's treasury covers all their winning bids simultaneously. If a player's winning bids total exceeds treasury (edge case: treasury changed during auction):
   - Sort their winning bids by bid amount descending
   - Honour bids from highest to lowest until treasury is exhausted
   - Remaining won riders go to the next-highest bidder
4. **Winning bid amount = purchase price** (one-time deduction from treasury)
5. **Contract salary = rider's current market salary** (locked for the duration of employment)
6. Résultats visibles immédiatement dans l'interface (pas d'email)

### 7.4 Auction History

All past auctions are stored and viewable:
- Who won each rider and at what price
- How prices compare to market salary (% premium paid)
- Your own bid history per rider

---

## 8. Contract System

When a player wins a rider at auction, a **contract** is created:

| Field | Value |
|-------|-------|
| `purchase_price` | Winning auction bid (one-time) |
| `contract_salary` | Market salary at auction date (monthly, locked) |
| `contract_start_date` | Day auction resolves |
| `status` | `active` / `notice` / `released` |

### 8.1 Releasing a Rider

- Player initiates release → rider enters **1-month notice** period
- Player pays **1 more month's salary** during notice
- Rider slot is freed **immediately** (available for next auction while notice runs)
- At end of notice period, contract is terminated

### 8.2 Auto-Release (Bankruptcy)

Triggered at start of Month 2 of negative treasury (see §2.4):
- Riders released: most expensive salary first, until remaining roster's monthly salary ≤ projected treasury
- No notice period for auto-release — immediate
- Banner d'alerte in-app avec liste des coureurs libérés

---

## 9. Two-Score Database Design (Summary for Engineers)

The scoring DB must maintain two separate sums per rider per day:

```
rider_daily_score:
  - rider_id
  - team_id
  - date
  - pcs_points_raw        (actual PCS points gained this day)
  - xp_with_multipliers   (raw × policy bonuses)

team_score_daily:
  - team_id
  - date
  - xp_gained_today       (sum of all riders' xp_with_multipliers)
  - cumulative_xp         (running sum — this drives level + ranking)

treasury_log:
  - team_id
  - date
  - amount                (positive = inflow, negative = outflow)
  - type                  (auction_win / salary / revenue / sponsor / starting_fund)
  - description
```

**The league leaderboard is always sorted by `cumulative_xp` DESC.**

---

## Appendix: Key Constants (MVP)

| Constant | Value | Status |
|---------|-------|--------|
| Starting treasury | 500,000€ | Confirmed |
| Salary floor | 5,000€/mo | Confirmed |
| Salary cap | 300,000€/mo | Confirm with real data |
| Conversion rate (€/PCS pt) | **500€ (placeholder)** | ⚠️ Must calibrate |
| Auction duration | 72 hours | Confirmed |
| Minimum bid | = market salary | Confirmed |
| Minimum bid increment | 100€ | Confirmed |
| Max policy slots | 3 (at level 10) | Confirmed |
| Max team slots | 12 (at level 10) | Confirmed |
| Sponsor contract duration | 2 months | Confirmed |
| Max active sponsors | 1 | Confirmed |
| Level count | 10 | Confirmed |
| XP multiplier per level | ×1.4 | Calibrate with real data |
