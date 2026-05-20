# WattHunter — Game Overview

> General documentation for competitive analysis and product positioning.
> Last updated: 2026-05-12

---

## What Is WattHunter?

WattHunter is a **web-based cycling fantasy league** for friend groups (up to 20 players). Players act as sports directors: they recruit professional cyclists through a **sealed-bid auction system**, build a team constrained by a real budget, and accumulate XP based on real race results pulled from ProCyclingStats (PCS).

The game runs in sync with the **UCI World Tour calendar** — 8 phases, from Season Start in January through La Vuelta in September. Each phase has 3 auction rounds.

---

## Core Dual-Indicator System

Two independent metrics define every team:

| Indicator | What it drives | How it grows |
|-----------|---------------|-------------|
| **XP** | League ranking, team level, feature unlocks | Race results from your riders |
| **Treasury (€)** | Bidding power | Sponsor income − rider salaries |

XP and treasury are **decoupled** — money doesn't buy XP directly, but a strong treasury lets you recruit higher-ranked riders who generate more XP.

---

## Economy

### Starting Budget
Every team starts with **200,000 EUR**.

### Income
- **Sponsor payment** — fixed income per phase (250k EUR at T1 → 1.25M EUR at T6)
- **Sponsor bonuses** — extra money credited when a team rider achieves qualifying race results (top placings, stage wins, monument/GT performances)

### Expenses
- **Rider salaries** — deducted once per phase at Payday

### Salary Formula
```
Monthly salary = max(5,000, floor(PCS_1yr_points × 2,000 / 12 / 100) × 100)
```

The bid you win at auction becomes the rider's **recurring monthly salary** — this is not a one-time purchase. A salary is locked for the duration of the contract.

Examples:
- PCS #600 (114 pts) → 19,000 EUR/month
- PCS #100 (400 pts) → 66,600 EUR/month
- PCS #5 (2,216 pts) → 369,300 EUR/month

### Payday
Each player confirms their phase setup independently:
1. Review and adjust sponsor, releases, strategies
2. Click "Confirm" → `treasury += sponsor_budget − salaries`
3. Payday activates pending sponsor/strategy changes
4. Player enters auction mode for the phase

### Bankruptcy Cascade
If `treasury < −10,000 EUR` after payday:
1. Auto-release the rider with the highest cumulative XP (most "valuable" — no refund)
2. Repeat until treasury ≥ −10,000 EUR or roster is empty

---

## Auctions

### Format
**Sealed-bid**, 3 rounds per phase, 8 phases per season = 24 auction rounds total.

### Rules
- Minimum bid = rider's market salary (formula above)
- Bids must be multiples of 100 EUR
- Bid increment: 100 EUR minimum
- Budget validation: `sum(active bids) + new bid` cannot exceed available treasury
- During a round: bid amounts are secret. Only "Won" / "Outbid" statuses are visible to others.

### Resolution
1. Highest bid wins
2. Tiebreaker: earliest bid timestamp
3. Cascade budget check (sorted by amount descending)
4. Winner gets the rider at `locked_salary` = winning bid

### Round Lifecycle
- Each player validates their round (confirms bids)
- When all league members validate → **auto-resolution**
- Any member can manually trigger "Resolve Round" as fallback
- Commissioner can edit round dates at any time before closure

### 7-Day Release Cooldown
After a rider is released, no one in the league can bid on them for 7 calendar days. Prevents the bid → check salary → release → re-bid exploit.

---

## Rider Pool

**Top 600 riders** in the PCS global individual ranking (rolling 12 months).

Access is **level-gated** — higher-ranked riders (better real-world performers) are locked until your team reaches the required level:

| Level | PCS rank accessible |
|-------|---------------------|
| 1 | #300–600 |
| 2 | #200–600 |
| 3 | #100–600 |
| 4 | #30–600 |
| 5 | #20–600 |
| 6 | #10–600 |
| 7 | #4–600 |
| 8 | #1–600 |

---

## Team Progression (8 Levels)

Levels are aligned to WT phases. XP thresholds are stretched at end-game to slow the leader.

| Level | XP Required | Roster Slots | Max Strategies | New Unlock |
|-------|-------------|--------------|----------------|------------|
| 1 | 0 | 6 | 1 | Specialty strategy, T1 sponsor |
| 2 | 25 | 7 | 1 | T2 sponsor |
| 3 | 150 | 8 | 2 | Nationality strategy, T3 sponsor |
| 4 | 350 | 9 | 2 | T4 sponsor |
| 5 | 600 | 10 | 2 | Teams strategy |
| 6 | 1,200 | 11 | 2 | T5 sponsor |
| 7 | 1,800 | 12 | 3 | Age strategy |
| 8 | 2,400 | 12 | 3 | T6 sponsor (UAE) |

---

## Scoring

```
Rider XP = daily PCS points × (1 + sum of active strategy bonuses)
Team XP  = sum of XP from all roster riders
```

PCS points are real race results scraped from ProCyclingStats. Scoring runs after every real race is imported.

---

## Strategies

XP multipliers applied to specific subsets of your roster. +5% per active strategy.

| Strategy | Bonus | Scope |
|----------|-------|-------|
| Specialty | +5% | Riders of a chosen specialty (GC / Sprint / TT / OneDay) |
| National Pride | +5% | Riders of a chosen nationality |
| Team Chemistry | +5% | Riders from a chosen UCI team |
| Age | +5% | Riders in a chosen age bracket (< 23 or > 32) |

Bonuses are **additive**: National Pride (France) + Specialty (Sprinter) = +10%.

**Timing:**
- Changed in Round 1 of a phase → takes effect immediately
- Changed in Round 2+ → pending until next Payday

---

## Sponsors

1 sponsor per team, gated by level only.

### 6 Tiers, 13 Sponsors

| Tier | Level | Budget/phase | Orientation |
|------|-------|-------------|-------------|
| T1 | 1 | 250,000 EUR | Neutral (Lotto) |
| T2 | 2 | 350,000 EUR | Neutral (Astana) |
| T3 | 3 | 450,000 EUR | GC: Groupama-FDJ, Movistar / OneDay: Alpecin, Uno-X |
| T4 | 4 | 750,000 EUR | GC: Ineos, Decathlon AG2R / OneDay: Soudal QS, Lidl-Trek |
| T5 | 6 | 1,000,000 EUR | Prestige: Visma / Regular: Red Bull-Bora |
| T6 | 8 | 1,250,000 EUR | Neutral (UAE Team Emirates) |

### Race Result Bonuses
Sponsors pay **extra bonuses** when your riders perform in qualifying races:

- T1–T4: 3 bonus lines (GC classification, One-Day result, Stage win) + multipliers
  - ×2 for Monument or Grand Tour
  - ×1.25 for nationality match with sponsor
  - Combinable: Monument + nationality = ×2.5
- T5–T6: explicit prestige bonuses (Monument / GT GC / Stage win) — no nationality multiplier

**Timing rule:** same as strategies — Round 1 = immediate, Round 2+ = pending.

---

## Grand Tour Mode

Activated automatically during the 3 Grand Tours (Giro, Tour, Vuelta).

### GT Squad Builder
- Select up to 8 riders from your roster for the GT squad
- Assign roles: GC leader, Domestique, Stage Hunter, etc.
- Swaps are free during the active phase (no lock-in before the GT)

### GT Tactics (5 per Grand Tour)
Each tactic can be used **once per GT**, placed before a stage (11:00 CET cutoff).

| Tactic | Effect | Scope |
|--------|--------|-------|
| **Unleash** | ×1.5 XP | All non-GC riders on roster (domestiques) |
| **Overdrive** | ×2.0 XP | 1 specific stage hunter rider |
| **Nemesis GC** | PvP duel on GC classification | 1 rival team's GC rider |
| **Nemesis Sprint** | PvP duel on sprint classification | 1 rival team's sprinter |
| **Call the Bus** | Bench riders contribute XP | All bench riders |

Scoring order: strategies → tactics → Remontada Boost (see below).

---

## Anti-Runaway System

3 permanent league-wide mechanisms to limit runaway leaders.

### 1. Remontada Boost
- Triggers during Grand Tours only, for teams ranked 4th or lower
- When team A overtakes team B → A gets **×2 XP multiplier for the next 3 stages**
- 1 trigger per ordered pair (A→B) per GT — resets at the next GT
- Visual: "Remontada Boost active" banner on the GT page

### 2. Co-Unlock Rule
- A player can only bid on a rider if **≥2 players in the league** have the level required for that rider
- Prevents monopolization of top riders by the only high-level player
- Released exclusive riders enter "locked" state until a 2nd eligible player exists

### 3. Level Curve Stretch
- XP thresholds for levels 6–8 are raised to slow end-game progression
- Effect: players cluster at levels 4–6 longer, reducing slot/budget/pool asymmetry between leader and laggards

---

## WT Phases & Calendar

| # | Phase | Period | Auction Rounds |
|---|-------|--------|----------------|
| 1 | Season Start | Jan 15 – Mar 1 | Jan 15/16/17 |
| 2 | Classics Part 1 | Mar 2 – Apr 1 | Mar 2/3/4 |
| 3 | Classics Part 2 | Apr 2 – May 1 | Apr 2/3/4 |
| 4 | Giro d'Italia | May 2 – Jun 1 | May 2/3/4 |
| 5 | Pre-Tour | Jun 2 – Jul 1 | Jun 2/3/4 |
| 6 | Tour de France | Jul 2 – Jul 27 | Jul 2/3/4 |
| 7 | Post-Tour | Jul 28 – Aug 18 | Jul 28/29/30 |
| 8 | La Vuelta | Aug 19 – Sep 15 | Aug 19/20/21 |

Commissioner can edit round dates at any time before a round closes.

---

## Leagues

- Up to 20 players per league
- Private league with invite code (6 characters)
- No minimum player count to launch
- Once active, no new teams can join
- A player can be in multiple leagues simultaneously
- Commissioner role: manage rounds, force-resolve, grant XP adjustments

---

## Pages & UX

### Home
Dashboard: team overview, XP, ranking position, active GT banner, current phase status.

### Team — My Riders tab
Active roster with individual XP per rider, pending bids (visible during active round only), outbid alerts, team level progress bar.

### Team — Recruits tab (Market)
Full rider pool filtered to eligible riders. Filter by: All / Teams / Specialty / Nationality / Age. Accordion groups. Inline bid input with salary pre-filled. Live budget remaining counter.

### Team — GT tab
GT squad builder, role assignment, and GT Tactics placement. Active only during Grand Tours.

### Team — Strategies tab
Up to 3 active strategies depending on level. Visual coverage preview (X/Y riders matched).

### Budget
Phase-based P&L view: balance, income, outgoing. Sponsor cards with race bonus conditions. Transaction history (bonuses, salaries, sponsorships). Filterable by type.

### Budget — Sponsor Marketplace
Full sponsor catalogue grouped by tier. Locked tiers shown at reduced opacity. Sponsor switch preview with new monthly budget. Pending change notice if changed mid-phase.

### Rider Detail
- From My Team context: PCS Stats + Game Stats, bid zone, release action
- From Ranking context: Game Stats only, read-only, "Owned by" banner

### Auction (Commissioner tools)
Round calendar, status table, force-resolve. Round date editing.

### Ranking — Teams tab
League standings sorted by XP. Movement tags (+N / −N). My team highlighted. Tap → opponent team detail.

### Ranking — Riders tab
All 600 pool riders sorted by XP earned in-game. Owned riders flagged with cyan border. Free agents shown at 60% opacity. Race filter for single-race view.

### Levels
Full 8-level progression roadmap with XP required, slot count, strategy slots, and sponsor tier per level.

### Budget — Transactions
Full transaction history, filterable by type, grouped by month, phase-navigation.

---

## Data Pipeline

Rider data is sourced from **ProCyclingStats** via a local Python scraping service:

- **Top 600 riders** (global PCS ranking, rolling 12 months) — synced annually
- **Race results** — imported after each WT race via `post-race` pipeline
- **Startlists** — upcoming race programme per rider
- **Rider enrichment** — photo, bio, specialty, team history

Pipeline runs **locally only** (residential IP required — Cloudflare blocks datacenter IPs). No automated sync; commissioner triggers imports manually.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Salary = recurring monthly cost (not one-time) | Creates sustained financial pressure; squad management is ongoing |
| Auction = sealed bid | Prevents last-second sniping; rewards research over reflexes |
| XP and treasury decoupled | Two distinct competitive axes; a rich team isn't automatically leading |
| Level gating on rider pool | Prevents new players from targeting top riders; progressive onboarding |
| Phase-locked releases | Prevents gaming the system around salary calculations |
| Sponsor bonuses on race results | Connects sponsor choice to roster composition; adds strategic depth |
| Remontada Boost GT-only | Comeback mechanic applied where score swings are largest |
| Co-Unlock Rule | Prevents monopolization of elite riders by a single high-level player |
| Commissioner-controlled round dates | Flexibility for IRL scheduling without hard-coded dates |
