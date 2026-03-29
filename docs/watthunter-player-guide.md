# WattHunter — Complete Player Guide

> This document covers every rule, formula, and mechanic in WattHunter. You can share it with an AI assistant to get answers to any question about the game.

---

## 1. What is WattHunter?

WattHunter is a **fantasy cycling manager** based on real-world professional cycling data from [ProCyclingStats (PCS)](https://www.procyclingstats.com/). You manage a team of professional riders, earn XP from their race performances, and compete against other managers in your league.

### The Game Loop

1. **Bid at auctions** — recruit riders during auction windows
2. **Riders race** — your riders earn PCS points from real-world race results
3. **Earn XP + bonuses** — PCS points convert to XP (your score) and bonuses (your cash)
4. **Level up** — unlock better riders, more roster slots, and new policies
5. **Repeat** — build the strongest team across the season

### How to Win

The team with the **most cumulative XP** at the end of the season wins. Smart budget management and discovering "hidden gems" (cheap riders who overperform) are the keys to success.

### Two Key Metrics

| Metric | Purpose | How it works |
|--------|---------|-------------|
| **XP (Team Score)** | League ranking & progression | Cumulative — earned daily from rider race results. Never decreases. |
| **Treasury (EUR)** | Budget management | Cash balance — income minus expenses. Determines your bidding power. |

---

## 2. Getting Started

### Creating an Account

1. Go to WattHunter and sign up with your **email** or **Google account**
2. Complete the onboarding flow (3 feature cards explaining the game basics)
3. You're ready to create or join a league

### Creating a League

1. Tap **Create a League**
2. Choose a league name
3. Share the generated **6-character invite code** with your friends
4. As the league creator, you become the **Race Director** (commissioner)

### Joining a League

1. Tap **Join a League**
2. Enter the 6-character code you received from the league creator
3. Choose your team name
4. You're in — wait for the Race Director to launch the first auction

### The Lobby

Before the season starts, the league sits in the **Lobby**. Here:

- Players join using the invite code
- The Race Director configures auction dates and launches the first auction
- Everyone can browse the available rider pool

### Race Director

The league creator is the Race Director. They are responsible for:

- Inviting players to the league
- Launching auctions at the right time
- Managing the league schedule

---

## 3. Season Structure & Phases

The WattHunter season runs from **January to October**, divided into **9 auction phases** aligned with the real professional cycling calendar. The 2026 WorldTour features **36 races**.

### Phase Calendar (2026)

| # | Phase | Period | Auction Rounds | Key Races |
|---|-------|--------|---------------|-----------|
| 1 | Season Start | Jan 15 – Mar 1 | R1: Mar 2, R2: Mar 3, R3: Mar 4 | Tour Down Under, Cadel Evans, UAE Tour, Omloop |
| 2 | Classics Part 1 | Mar 5 – Apr 1 | R1: Apr 2, R2: Apr 3, R3: Apr 4 | Strade Bianche, Paris-Nice, Tirreno, Milan-San Remo, Catalunya |
| 3 | Classics Part 2 | Apr 5 – May 1 | R1: May 2, R2: May 3, R3: May 4 | Tour of Flanders, Paris-Roubaix, Amstel Gold, Liège-Bastogne-Liège |
| 4 | Giro d'Italia | May 5 – Jun 1 | R1: Jun 2, R2: Jun 3, R3: Jun 4 | Giro d'Italia |
| 5 | Pre-Tour | Jun 5 – Jul 1 | R1: Jul 2, R2: Jul 3, R3: Jul 4 | Critérium du Dauphiné, Tour de Suisse |
| 6 | Tour de France | Jul 4 – Jul 27 | R1: Jul 28, R2: Jul 29, R3: Jul 30 | Tour de France |
| 7 | Post-Tour | Jul 31 – Aug 18 | R1: Aug 19, R2: Aug 20, R3: Aug 21 | San Sebastián, Pologne, Cyclassics |
| 8 | La Vuelta | Aug 22 – Sep 15 | R1: Sep 16, R2: Sep 17, R3: Sep 18 | Vuelta a España, GP Québec, GP Montréal |
| 9 | End of Season | Sep 19 – Oct 18 | — (no auctions) | Il Lombardia, Tour of Guangxi |

### How It Works

Each phase follows the same cycle:

1. **Races happen** during the phase period — your riders earn PCS points
2. **3 auction rounds open** on consecutive days at the end of the phase (24h each, 72h total)
3. **Next phase begins** — new races, new opportunities

Phase 9 (End of Season) has **no auctions** — it's the final stretch where rankings are locked in.

---

## 4. Auctions & Bidding

Auctions are how you recruit riders for your team. Each auction consists of **3 rounds of 24 hours** (72 hours total), using a **sealed-bid** format.

### Auction Rules

| Rule | Value |
|------|-------|
| Duration | 72 hours (3 rounds of 24h) |
| Format | Sealed-bid — bids are secret during each round |
| Minimum bid | Rider's market salary (PCS-based formula) |
| Minimum increment | +100 EUR over any competing bid |
| Tie-breaker | Earliest timestamp wins |

### Critical: Your Bid = Monthly Salary

**Your bid is NOT a one-time purchase price.** It becomes the rider's **locked monthly salary** for the entire duration of their contract. Bidding high means committing to a high recurring cost.

### Budget Validation

Before placing a bid, the system checks:

```
sum(all your active bids in this auction) + new bid ≤ treasury
```

If you can't afford it, your bid is rejected. You also need an **available roster slot** to recruit a rider.

### Level Gating

You can only bid on riders that are **within your level's rider pool**. For example, at Level 1, you can only bid on riders ranked #351–500. See [Team Levels & Progression](#11-team-levels--progression) for the full table.

### Bid Visibility

- **During a round:** your bids are secret (only visible to you)
- **After a round resolves:** won/outbid results are visible to all league members
- **After the auction closes:** all bids become fully visible

### Resolution

After each 24h round:

1. Bids are grouped by rider
2. **Highest bid wins** (tie-break: earliest timestamp)
3. Budget is verified in cascade (riders sorted by bid descending)
4. The winning bid becomes the rider's **locked contract salary**
5. A contract is created immediately
6. The **first month's salary** is debited from the winner's treasury

### One Contract Per Rider

Each rider can only have **one active contract per league**. If a rider is already under contract with another team, no one else can bid on them.

---

## 5. Riders & Salaries

### The Rider Pool

The available rider pool is the **Top 500 of the PCS global ranking** (rolling 12-month window). This ranking updates after each race result.

Not all 500 riders are available to you from the start — your **team level** determines which portion of the pool you can access (see [Team Levels](#11-team-levels--progression)).

### Rider Data

For each rider, you can see:

- **PCS Rank** — their position in the global PCS ranking
- **PCS Points (1y)** — total points earned in the last 12 months
- **Specialty** — GC, Sprint, TT, or One Day
- **Nationality** — country of origin
- **UCI Team** — their real-world professional team
- **Age, Height, Weight** — physical attributes
- **Season Results** — race history and performance

### Market Salary Formula

Every rider has a **market salary** determined by their PCS points:

```
Monthly salary = PCS_points_1y × 2,000 / 12
Floor: 5,000 EUR/month (minimum)
No cap (no maximum)
```

When you win an auction, your bid (which must be ≥ market salary) becomes the rider's **locked salary**. This locked salary stays fixed for the entire contract — it does not change even if the rider's PCS points change later.

### Salary Examples

| Rider Rank | PCS Points (1y) | Annual Value | Monthly Salary |
|-----------|----------------|-------------|---------------|
| #500 | 114 | 228,000 EUR | 19,000 EUR |
| #100 | 400 | 800,000 EUR | 66,667 EUR |
| #5 (Vingegaard) | 2,216 | 4,432,000 EUR | 369,333 EUR |
| #1 (Pogačar) | 4,552 | 9,104,000 EUR | 758,667 EUR |

> Note: PCS points and ranks are approximate and change after every race.

---

## 6. Contracts & Releases

### Contract Lifecycle

Every contract follows this lifecycle:

```
Auction Won → Active → (optional) Notice → Released
```

| Status | Meaning |
|--------|---------|
| **Active** | Rider is on your roster, earns XP, costs salary |
| **Notice** | You have initiated a release — rider stays until next phase |
| **Released** | Rider is off your roster, returns to the auction pool |

### Releasing a Rider

- You can **manually release** a rider during the **auction window** (the 3-day period at the end of each phase)
- The rider enters **notice** status — they remain on your roster for the current phase
- At the **start of the next phase**, the rider is officially released and returns to the auction pool
- You stop paying their salary from the next phase onward

### Auto-Release (Bankruptcy)

If you go bankrupt (see [Bankruptcy](#14-bankruptcy)), riders are released **immediately** with no notice period. The system automatically releases your **best-scoring riders first** (highest cumulative XP) until your treasury is back above zero.

### Uniqueness Rule

Each rider can only have **one active or notice contract per league** at any time. A released rider becomes available for other teams to bid on.

---

## 7. XP & Scoring

XP is your team's score and the primary metric for league rankings. It is **cumulative** — once earned, XP never decreases.

### How XP is Calculated

XP is calculated **daily** after race results come in. When any of your riders earns PCS points from a race:

```
Rider XP = PCS_points_of_the_day × (1 + sum_of_active_policy_bonuses)
Team XP = sum(all riders' XP earned across all races)
```

### Properties

| Property | Detail |
|----------|--------|
| Timing | Calculated daily after race results |
| Accumulation | Cumulative — XP never decreases |
| Ranking | League-wide, sorted by total Team XP |
| Policy boost | Additive — each matching policy adds +5% per rider |

### Example

Your rider scores **40 PCS points** today. You have 2 active policies and the rider matches both (+10% total):

```
Rider XP = 40 × (1 + 0.10) = 44 XP added to your team
```

If the rider only matched one policy (+5%):

```
Rider XP = 40 × (1 + 0.05) = 42 XP
```

If no policies match:

```
Rider XP = 40 × (1 + 0) = 40 XP
```

### Level Progression

Your **cumulative XP** determines your team level, which unlocks new features. See [Team Levels](#11-team-levels--progression) for XP thresholds.

---

## 8. PCS Points Explained

**ProCyclingStats (PCS)** is the reference website for professional cycling statistics. PCS assigns points to riders based on their finishing position in each race. Points vary by race prestige.

**Important:** PCS points ≠ UCI points. WattHunter uses the ProCyclingStats proprietary point system, not the UCI ranking.

PCS points are cumulated over a **rolling 12-month window**. A rider's PCS ranking reflects their total points across all races in that period.

### Race Categories

| Category | Example Races |
|----------|-------------|
| **Tour de France** | Tour de France only |
| **Giro / Vuelta** | Giro d'Italia, Vuelta a España |
| **Monument** | Milan-San Remo, Tour of Flanders, Paris-Roubaix, Liège-Bastogne-Liège, Il Lombardia |
| **WT Stage Race** | Paris-Nice, Dauphiné, Tour de Suisse, Tirreno-Adriatico, etc. (12 races) |
| **WT Classic** | Strade Bianche, Amstel Gold, Flèche Wallonne, etc. (16 races) |

### GC & One-Day Race Points

| Position | TdF GC | Giro/Vuelta GC | Monument | WT Stage Race | WT Classic |
|----------|--------|---------------|----------|-------------|-----------|
| 1st | 500 | 400 | 275 | 250 | 225 |
| 2nd | 380 | 290 | 200 | 190 | 150 |
| 3rd | 340 | 240 | 150 | 160 | 110 |
| 4th | 300 | 220 | 120 | 140 | 90 |
| 5th | 280 | 200 | 100 | 120 | 80 |
| 6th | 260 | 190 | 90 | 110 | 70 |
| 7th | 240 | 180 | 80 | 100 | 60 |
| 8th | 220 | 170 | 70 | 90 | 50 |
| 9th | 210 | 160 | 60 | 80 | 46 |
| 10th | 200 | 150 | 50 | 70 | 42 |
| 11th | 190 | 140 | 46 | 60 | 38 |
| 12th | 180 | 130 | 42 | 55 | 34 |
| 13th | 170 | 120 | 38 | 50 | 30 |
| 14th | 160 | 110 | 34 | 45 | 26 |
| 15th | 150 | 100 | 30 | 40 | 22 |
| 16th | 140 | 90 | 28 | 36 | 20 |
| 17th | 130 | 85 | 26 | 32 | 18 |
| 18th | 120 | 80 | 24 | 28 | 17 |
| 19th | 110 | 75 | 22 | 24 | 16 |
| 20th | 100 | 70 | 20 | 20 | 15 |

### Stage Result Points

| Position | TdF Stage | Giro/Vuelta Stage | WT Stage |
|----------|-----------|-------------------|----------|
| 1st | 100 | 80 | 50 |
| 2nd | 70 | 50 | 30 |
| 3rd | 50 | 35 | 18 |
| 4th | 40 | 25 | 13 |
| 5th | 32 | 18 | 10 |
| 6th | 26 | 15 | 7 |
| 7th | 22 | 12 | 4 |
| 8th | 18 | 10 | 3 |
| 9th | 14 | 8 | 2 |
| 10th | 10 | 6 | 1 |

---

## 9. Race Bonuses & Hidden Gems

Race bonuses are **cash income** earned when your riders score PCS points in a race. This is separate from XP.

### Bonus Formula

```
Race bonus = max(0, race_points × 1,500 − monthly_salary)
```

- **race_points**: PCS points earned by your rider in that specific race
- **1,500**: conversion rate (EUR per PCS point)
- **monthly_salary**: the rider's locked salary (from your winning auction bid)

If the formula yields a negative number, the bonus is **0** — a rider never costs you more than their salary.

### The "Hidden Gem" Mechanic

This is the core strategic mechanic of WattHunter. Because the bonus conversion rate (1,500 EUR/point) is intentionally **lower** than the salary rate (2,000 EUR/point), expensive star riders almost **never generate bonuses**.

Meanwhile, cheap riders (ranked #400–500 with low salaries) generate bonuses **as soon as they score any race points**.

### Bonus Examples

| Rider | Monthly Salary | Race Points | Bonus Calculation | Bonus Earned |
|-------|---------------|-------------|-------------------|-------------|
| #450 rider | 21,000 EUR | 20 pts | 20 × 1,500 − 21,000 = 9,000 | **9,000 EUR** |
| #100 rider | 67,000 EUR | 30 pts | 30 × 1,500 − 67,000 = −22,000 | **0 EUR** |
| #1 Pogačar | 759,000 EUR | 100 pts (TdF stage win) | 100 × 1,500 − 759,000 = −609,000 | **0 EUR** |
| #400 rider | 5,000 EUR (floor) | 10 pts | 10 × 1,500 − 5,000 = 10,000 | **10,000 EUR** |

### Strategic Implications

- **Stars give XP but no cash** — a Tour de France winner on your team boosts your ranking but drains your budget
- **Hidden gems give XP AND cash** — a cheap rider who surprises at a Monument can fund your next auction bid
- **Balance is key** — you need some stars for consistent XP, but hidden gems keep your treasury healthy
- The best managers find **undervalued riders** who are about to have a breakout race

---

## 10. Policies (XP Boosters)

Policies are **XP multipliers** that reward you for building a thematic roster. Each matching rider gets a **+5% XP bonus** per active policy they qualify for. Bonuses are **additive** across multiple policies.

### Policy Types

| Policy | Slug | Bonus | Unlock Level | Configuration |
|--------|------|-------|-------------|--------------|
| **Speciality** | specialist | +5% per matching rider | Level 1 | Choose a specialty: GC, Sprint, TT, or One Day |
| **Nationality** | national_pride | +5% per matching rider | Level 3 | Choose a country (any nationality in the pool) |
| **Teams** | team_chemistry | +5% per matching rider | Level 5 | Choose a UCI WorldTeam |
| **Young Blood** | young_blood | +5% per matching rider | Level 7 | Choose a max age: 23, 25, or 28 years old |
| **Road Warriors** | road_warriors | +5% per matching rider | Level 7 | Automatic — applies to all riders over 32 years old |

### Max Active Policies

You can only have a limited number of policies active at the same time:

| Team Level | Max Active Policies |
|-----------|-------------------|
| Level 1–2 | 1 |
| Level 3–8 | 2 |
| Level 9–10 | 3 |

### How Matching Works

Each policy checks a specific attribute of your riders:

- **Speciality:** rider's specialty must match your chosen specialty (e.g., "Sprint")
- **Nationality:** rider's nationality must match your chosen country (e.g., "Belgium")
- **Teams:** rider's UCI team must match your chosen team (e.g., "UAE Team Emirates")
- **Young Blood:** rider's age must be ≤ your chosen max age (23, 25, or 28)
- **Road Warriors:** rider's age must be > 32 (automatic, no configuration needed)

### Bonus Stacking Example

You activate **Nationality (Belgium)** and **Speciality (Sprint)**:

| Rider | Nationality | Specialty | Policies Matched | XP Bonus |
|-------|------------|-----------|-----------------|----------|
| Belgian sprinter | Belgium | Sprint | Both (+5% +5%) | **+10%** |
| Belgian climber | Belgium | GC | Nationality only | **+5%** |
| French sprinter | France | Sprint | Speciality only | **+5%** |
| French climber | France | GC | Neither | **+0%** |

If the Belgian sprinter earns 50 PCS points:

```
XP = 50 × (1 + 0.10) = 55 XP
```

### Changing Policies

- You can change your active policies at any time
- **During the auction window:** changes take effect immediately
- **Outside the auction window:** changes take effect at the **start of the next phase**

This "phase-deferred" mechanism prevents mid-phase gaming.

---

## 11. Team Levels & Progression

Your team has 10 levels of progression. Your **cumulative XP** determines your level. Each level unlocks new features.

### Level Table

| Level | XP Required | Roster Slots | Max Policies | Rider Pool | New Unlock |
|-------|------------|-------------|-------------|-----------|-----------|
| 1 | 0 | 6 | 1 | #351–500 | Speciality policy |
| 2 | 50 | 8 | 1 | #251–500 | — |
| 3 | 150 | 8 | 2 | #176–500 | Nationality policy, Sponsor T2 |
| 4 | 300 | 9 | 2 | #101–500 | — |
| 5 | 500 | 10 | 2 | #76–500 | Teams policy, Sponsor T3 |
| 6 | 700 | 10 | 2 | #51–500 | — |
| 7 | 1,000 | 11 | 2 | #26–500 | Age policies (Young Blood + Road Warriors), Sponsor T4 |
| 8 | 1,400 | 12 | 2 | #11–500 | Sponsor T5 |
| 9 | 1,900 | 12 | 3 | #4–500 | 3rd policy slot |
| 10 | 2,500 | 12 | 3 | #1–500 | Full pool access (podium top 3) |

### Rider Pool Gating

The total rider pool is the **Top 500 of the PCS global ranking**. At lower levels, you can only access lower-ranked riders:

- **Level 1:** riders ranked #351 to #500 (150 riders available)
- **Level 5:** riders ranked #76 to #500 (425 riders available)
- **Level 10:** riders ranked #1 to #500 (all 500 riders available)

This means the very best riders in the world (Pogačar, Vingegaard, van der Poel, etc.) are only available to teams at Level 9 or 10.

### What Gets Unlocked

- **Roster Slots (6 → 12):** more riders on your team = more XP potential
- **Rider Pool (150 → 500 riders):** access to better-ranked riders with higher PCS points
- **Policy Slots (1 → 3):** more XP multipliers to stack
- **Policy Types:** new ways to boost XP (specialty, nationality, team, age)
- **Sponsor Tiers:** higher-paying sponsors become available

### Level-Up

Leveling up is **automatic** — as soon as your cumulative XP reaches the threshold, your level increases immediately. No action required.

---

## 12. Sponsors & Income

Sponsors provide your team with **recurring income**, paid at the start of each auction phase. Higher-tier sponsors pay more but require a higher team level to unlock.

### Default Sponsor

Every team starts with a **default sponsor** that pays:

- **First phase:** 200,000 EUR
- **Subsequent phases:** 300,000 EUR

This is your baseline income if you don't select a specific sponsor. The default sponsor is always available regardless of level.

### Sponsor Tiers

Sponsors come in **5 tiers**, each with **2 options** (A and B):

- **Option A** — Fixed payment, no conditions. Lower amount but guaranteed.
- **Option B** — Lower base payment + a **bonus** if a specific condition is met. Higher potential total.

| Tier | Unlock Level | Option A (Fixed) | Option B (Base + Bonus) |
|------|-------------|-----------------|----------------------|
| **Tier 1** | Level 1 | VéloShop Basic | VéloShop Performance |
| **Tier 2** | Level 3 | SportNutrition Pro | SportNutrition Elite |
| **Tier 3** | Level 5 | CycleGear France | CycleGear Champions |
| **Tier 4** | Level 7 | EuroBank Cycling | EuroBank Trophy |
| **Tier 5** | Level 8 | TitanSport Global | TitanSport Legend |

### Sponsor Details

| Sponsor | Type | Base Payment | Bonus | Condition |
|---------|------|-------------|-------|-----------|
| **VéloShop Basic** | T1-A | Fixed per phase | — | None |
| **VéloShop Performance** | T1-B | Lower base | +bonus | Your team earned at least 1 XP this month |
| **SportNutrition Pro** | T2-A | Fixed per phase | — | None |
| **SportNutrition Elite** | T2-B | Lower base | +bonus | One of your riders finished top 10 in a race this month |
| **CycleGear France** | T3-A | Fixed per phase | — | None |
| **CycleGear Champions** | T3-B | Lower base | +bonus | Your team is in the top 3 of the league standings |
| **EuroBank Cycling** | T4-A | Fixed per phase | — | None |
| **EuroBank Trophy** | T4-B | Lower base | +bonus | One of your riders won a Grand Tour stage this month |
| **TitanSport Global** | T5-A | Fixed per phase | — | None |
| **TitanSport Legend** | T5-B | Lower base | +bonus | Your team is 1st in the league standings this month |

### Approximate Phase Income by Tier

| Tier | Approximate Payment per Phase |
|------|------------------------------|
| Default | 200,000 → 300,000 EUR |
| Tier 1 | ~200,000 EUR |
| Tier 2 | ~400,000 EUR |
| Tier 3 | ~550,000 EUR |
| Tier 4 | ~750,000 EUR |
| Tier 5 | ~1,000,000 EUR |

### Changing Sponsors

- You can change your sponsor at any time
- **During the auction window:** the change takes effect immediately
- **Outside the auction window:** the new sponsor becomes active at the **start of the next phase**

### Escalating Sponsors

Some sponsors have an **escalating** payment structure: the first payment is lower than subsequent payments. This prevents teams from switching sponsors right before a big payout.

---

## 13. Budget & Treasury

Your treasury is your team's **cash balance**. Managing it wisely is essential to surviving the season.

### Starting Balance

Every team starts with **200,000 EUR**.

### Income Sources

| Source | Timing | Amount |
|--------|--------|--------|
| **Sponsor payments** | Start of each phase | Depends on sponsor tier (see above) |
| **Race bonuses** | After each race | max(0, race_points × 1,500 − monthly_salary) per rider |

### Expenses

| Expense | Timing | Amount |
|---------|--------|--------|
| **Monthly salaries** | Each phase | Sum of all riders' locked salaries |
| **First salary** | At auction win | Debited immediately when you win an auction |

### Phase Financial Cycle

At the start of each phase:

1. **Sponsor payment is credited** to your treasury
2. **Monthly salaries are deducted** for all active/notice contracts

```
Treasury = starting_balance
         + cumulative_sponsor_payments
         + cumulative_race_bonuses
         − cumulative_salaries
```

### Budget Tips

- Don't spend everything on star riders — leave room for future auctions
- Race bonuses from hidden gems can fund your next big signing
- Monitor your salary burn rate vs. sponsor income
- You can release riders to reduce your salary burden

---

## 14. Bankruptcy

If your treasury goes negative, you're in financial trouble.

### Two-Stage Bankruptcy

| Stage | Condition | Consequences |
|-------|-----------|-------------|
| **Month 1 (Debt)** | Treasury < 0 after monthly finance | Blocked from auctions. You can still play and earn bonuses. |
| **Month 2 (Auto-Release)** | Treasury still < 0 after 2 consecutive months | Automatic rider releases until treasury is positive. |

### Auto-Release Rules

When auto-release kicks in:

1. Your riders are ranked by **cumulative XP earned** (highest first)
2. Your **best-scoring rider** is released first
3. Their salary is recovered (added back to treasury)
4. If treasury is still negative, the next best scorer is released
5. This continues until treasury ≥ 0

**Important:** Auto-releases have **no notice period** — riders are released immediately and return to the auction pool right away.

### How to Avoid Bankruptcy

- Keep your total salary bill below your sponsor income
- Release underperforming expensive riders before it's too late
- Invest in cheap riders who generate bonuses
- Don't overbid at auctions

### How to Recover

If you're in debt (Month 1):

- Your riders still race and earn bonuses — these bonuses increase your treasury
- You can release riders during the next auction window to cut costs
- If your treasury goes positive before Month 2, you escape bankruptcy

---

## 15. Navigation & Interface

### Mobile Layout

- **Top Bar:** WattHunter logo, current league name (tap to switch), user avatar
- **Bottom Navigation:** 4 tabs that are progressively unlocked:
  - **Home** — always visible. League lobby, next auction countdown, team level card
  - **Team** — visible after your first auction. Sub-pages: My Team, Recruits
  - **Budget** — visible after a completed auction round. Treasury overview, transaction history
  - **Ranking** — visible after a completed auction round. League standings

The bottom navigation **hides when you scroll down** and reappears when you scroll up, giving you more screen space.

### Desktop Layout

- **Sidebar (left, 180px):** navigation links with sub-items for Team (My Team / Recruits)
- **Main content (center):** the current page
- **Detail Rail (right):** context panel for rider details, auction info, etc.

### Key Pages

| Page | What you'll find |
|------|-----------------|
| **Home / Lobby** | League status, next auction countdown, team level progress, mesh gradient background |
| **My Team** | Your contracted riders, their salaries, XP earned, active policies |
| **Recruits** | Browse the available rider pool, filter by specialty/nationality/team, place bids |
| **Rider Detail** | Full rider profile — PCS stats, race history, contract info, salary |
| **Auctions** | Auction calendar, current round status, your bids, results |
| **Policies** | Manage your active policies, see matching riders |
| **Levels** | View all 10 levels, your progress, upcoming unlocks |
| **Settings** | Team name, league settings, account |

### Progressive Unlock

Not all tabs are visible from the start. Navigation items unlock as you progress:

- **Home**: always available
- **Team**: available after participating in your first auction
- **Budget & Ranking**: available after at least one auction round has been completed

---

## 16. Glossary

| Term | Definition |
|------|-----------|
| **XP** | Experience Points — your team's cumulative score. Earned from rider race results. Never decreases. |
| **Treasury** | Your team's cash balance in EUR. Used to pay salaries and place bids. |
| **PCS** | ProCyclingStats — the real-world cycling statistics website that provides all rider data and points. |
| **PCS Points** | Points assigned by ProCyclingStats based on race finishing positions. Rolling 12-month window. |
| **PCS Rank** | A rider's position in the PCS global ranking based on their cumulative PCS points. |
| **Market Salary** | The calculated minimum monthly salary for a rider: PCS_points × 2,000 / 12 (floor: 5,000 EUR). |
| **Locked Salary** | The actual monthly salary you pay for a rider, set by your winning auction bid. Always ≥ market salary. |
| **Race Bonus** | Cash earned when your rider scores PCS points: max(0, race_points × 1,500 − locked_salary). |
| **Conversion Rate** | The EUR-per-PCS-point rate used in the bonus formula. Currently 1,500 EUR/point. |
| **Hidden Gem** | A low-ranked, cheap rider who overperforms and generates significant race bonuses. |
| **Phase** | One of 9 periods in the season, each aligned with a section of the real cycling calendar. |
| **Auction** | A 72-hour bidding event at the end of each phase (3 rounds of 24h). |
| **Round** | One of 3 sequential 24-hour bidding periods within an auction. |
| **Sealed-Bid** | Auction format where bids are secret during each round and only revealed after resolution. |
| **Roster Slot** | A spot on your team for a contracted rider. Starts at 6, max 12 at Level 8+. |
| **Contract** | The agreement created when you win an auction bid. Defines the locked salary. |
| **Notice** | Contract status after you initiate a release. Rider leaves at the start of the next phase. |
| **Release** | Removing a rider from your team. Can be manual (during auction window) or automatic (bankruptcy). |
| **Auto-Release** | Forced release during bankruptcy. Best scorers are released first, no notice period. |
| **Policy** | An XP booster that gives +5% XP per matching rider. 5 types available, unlocked through levels. |
| **Specialty** | A rider's primary discipline: GC (general classification), Sprint, TT (time trial), or One Day. |
| **Sponsor** | Your team's financial backer. Provides recurring income each phase. 5 tiers with A/B options. |
| **Escalating Sponsor** | A sponsor whose first payment is lower than subsequent payments. |
| **Debt** | Treasury status when balance < 0 for one month. Blocks auction participation. |
| **Bankruptcy** | Treasury status when balance < 0 for two consecutive months. Triggers auto-release. |
| **Race Director** | The league creator who manages auction launches and league settings (commissioner). |
| **Lobby** | The pre-season phase where players join the league and the Race Director sets up the first auction. |
| **Rider Pool** | The Top 500 PCS-ranked riders available for recruitment. Pool access expands with level. |
| **Pool Gating** | The level-based restriction on which riders you can bid on (e.g., Level 1 = only #351–500). |
| **Level** | Your team's progression tier (1–10), determined by cumulative XP. Unlocks features and riders. |
| **WorldTour (WT)** | The highest tier of professional cycling races. WattHunter tracks the 2026 WT calendar. |
| **Grand Tour** | The three biggest stage races: Tour de France, Giro d'Italia, Vuelta a España. |
| **Monument** | The five most prestigious one-day races: Milan-San Remo, Tour of Flanders, Paris-Roubaix, Liège-Bastogne-Liège, Il Lombardia. |
| **UCI** | Union Cycliste Internationale — the governing body of professional cycling. |

---

## Quick Reference Card

### Key Formulas

```
Monthly Salary    = max(5,000, PCS_points × 2,000 / 12)
Race Bonus        = max(0, race_points × 1,500 − locked_salary)
Rider XP          = PCS_points × (1 + sum_of_policy_bonuses)
```

### Key Constants

| Constant | Value |
|----------|-------|
| Starting treasury | 200,000 EUR |
| Salary floor | 5,000 EUR/month |
| Salary coefficient | 2,000 EUR per PCS point per year |
| Bonus conversion rate | 1,500 EUR per PCS point |
| Auction duration | 72h (3 × 24h rounds) |
| Bid increment | +100 EUR minimum |
| Max roster slots | 12 (at Level 8+) |
| Max active policies | 3 (at Level 9+) |
| Policy bonus | +5% XP per matching rider per policy |
| Rider pool size | Top 500 PCS ranking |
| Season phases | 9 (8 with auctions + 1 final) |
