# WattHunter — Game Rules

> **Living document** — Updated with every rule change.
> Source of truth for implemented and planned game mechanics.
> Last updated: 2026-05-15

## Overview

WattHunter is a cycling fantasy game for friend groups. Players build virtual teams by bidding on professional riders at auction, earn points based on real PCS (ProCyclingStats) race results, and compete within their league.

---

## 1. Leagues

| Rule | Value |
|------|-------|
| Max players per league | 20 |
| Min players to launch | 1 (no minimum) |
| A player can be in multiple leagues | Yes |
| Invite code | 6 alphanumeric characters (no 0/O/1/I/l) |
| League statuses | pending → active → completed |

**Launch rules:**
- Only the commissioner (creator) can start the first auction
- Once the league moves to `active`, no new teams can join
- No minimum number of players required
- The commissioner selects a **starting level** (default: based on current date and WT phase)
- The commissioner can **edit round dates** at any time before an auction round closes

---

## 2. Two Independent Indicators

### Team Score (XP)
- XP accumulated since team creation
- Determines: league ranking, team level, feature unlocks
- Calculated on every race result import

### Treasury (EUR)
- Cash balance: income − expenses
- Determines: bidding power at auctions
- Always displayed in the header

**Strategic link:** XP and treasury are independent — money doesn't directly give XP. But a strong treasury lets you recruit better riders who generate more XP.

---

## 3. Riders

**Total pool:** Top 600 riders in the PCS global individual ranking (rolling 12 months)

**Data per rider:**
- Name, nationality, real UCI team
- Photo, age, specialty (GC / Sprint / TT / OneDay)
- Rolling 365-day PCS points, PCS rank, calculated monthly salary

**Access by level (PCS gating):**

| Level | PCS rank unlocked |
|-------|-------------------|
| 1 | #300–600 |
| 2 | #200–600 |
| 3 | #100–600 |
| 4 | #30–600 |
| 5 | #20–600 |
| 6 | #10–600 |
| 7 | #4–600 |
| 8 | #1–600 |

---

## 4. Economy

### 4.1 Starting Treasury

New teams start at **200,000 EUR**.

### 4.2 Income
- **Sponsor payment:** 1× per phase, at payday confirmation
- **Sponsor bonus:** on every qualifying race result (see §9)

### 4.3 Expenses
- **Rider salaries:** deducted at payday (1× per phase)
- **Won auctions:** salary locked immediately after auction resolution

### 4.4 Salary Formula

```
Monthly salary = max(5,000, floor(PCS_points_1yr × 2,000 / 12 / 100) × 100)
Floor: 5,000 EUR/month | Rounded down to nearest 100 | No cap
```

**Examples:**
- 114 pts PCS (#600) → 228K/yr → **19,000 EUR/month**
- 400 pts PCS (#100) → 800K/yr → **66,600 EUR/month**
- 2,216 pts PCS (#5) → 4.4M/yr → **369,300 EUR/month**

> **Note:** The salary determines the **minimum bid at auction**. The actual contract salary is the winning bid (= `locked_salary`).

### 4.5 Bankruptcy

At payday, after `treasury += sponsor_budget − salaries`:
- If treasury >= −10,000 EUR → no action (tolerance)
- If treasury < −10,000 EUR → **bankruptcy cascade:**
  1. Release the rider with the **highest cumulative XP** on the roster
  2. No release fee; the phase salary is not refunded
  3. If still < −10,000 EUR → repeat with the next rider
  4. Until treasury >= −10,000 EUR or roster is empty

---

## 5. Auctions

| Rule | Value |
|------|-------|
| Format | Sealed-bid, 3 rounds per phase |
| Minimum bid | Rider's market salary (formula §4.4) |
| Minimum increment | 100 EUR |
| Multiples | Bids must be multiples of 100 EUR |
| Calendar | 9 phases aligned to the WT, 3 rounds each |

> **Auction = recurring monthly salary:** The winning bid is NOT a one-time purchase price. It becomes the recurring monthly salary (`locked_salary`) deducted at every payday.

**Resolution:**
1. Highest bid wins
2. Tie: earliest timestamp wins (placed_at)
3. Budget cascade check (riders sorted by amount descending)
4. Winning bid → contract created with `locked_salary` = bid amount
5. Salary deducted immediately from treasury

**Budget validation:** `sum(active bids) + new bid > treasury` → bid rejected

**Prerequisite:** A player must have **confirmed the phase payday** before placing bids.

**Bid visibility:**
- During auction: `won` / `outbid` bids visible to all
- `active` bids (current round): secret
- After auction closes: all bids visible

### Round validation & resolution

- Each player must **validate their round** (confirm their bids) before the round closes.
- When **all league members have validated**, the round **auto-resolves** (consensus trigger).
- Any league member can manually trigger **"Resolve Round"** from the Status tab as fallback.
- Resolution applies the sealed-bid auction algorithm (above).
- The `round_validations` table tracks who validated when and the force-resolve audit trail.

### 7-day release cooldown

- After a rider is released, **no one in the league can bid on them for 7 calendar days**.
- This prevents the exploit: bid → check final salary → release → re-bid at minimum.
- Released riders appear in the market with an "Available from [date]" indicator until the cooldown ends.

---

## 6. Contracts

**At creation:**
- `locked_salary`: winning bid (recurring monthly salary, locked)
- `status`: active | released
- `phase_recruited_id`: recruitment phase (used for release lock)

**Releasing a rider:**
- Can be released **at any time**
- **No release fee** — the phase salary is not refunded
- Effect takes place at the **start of the next phase** (except bankruptcy auto-release, which is immediate)
- Rider returns to the pool, slot freed

---

## 7. Scoring & Levels

### Daily XP

```
Rider XP = daily_PCS_points × (1 + sum of active strategy bonuses)
Team XP  = sum of XP from all roster riders
```

### Level progression (8 levels aligned to WT phases)

| Level | WT Phase | XP Required | Slots | Max Strategies | PCS Pool | Strategy Unlocked | Sponsor Unlocked |
|-------|----------|-------------|-------|--------------|----------|-----------------|-----------------|
| 1 | Season Start | 0 | 6 | 1 | #300–600 | Speciality | Lotto T1 (250K) |
| 2 | Classics P1 | 25 | 7 | 1 | #200–600 | — | Astana T2 (350K) |
| 3 | Classics P2 | 150 | 8 | 2 | #100–600 | Nationality | T3 · 450K (×4) |
| 4 | Giro | 350 | 9 | 2 | #30–600 | — | T4 · 750K (×4) |
| 5 | Pre-Tour | 600 | 10 | 2 | #20–600 | Teams | T4 · 750K (×4) |
| 6 | Tour de France | 1,200 | 11 | 2 | #10–600 | — | T5 · 1M (×2) |
| 7 | Post-Tour | 1,800 | 12 | 3 | #4–600 | Age | T5 · 1M (×2) |
| 8 | La Vuelta | 2,400 | 12 | 3 | #1–600 | — | T6 UAE · 1.25M |

---

## 8. Strategies

4 types, +5% XP each. Max active: 1 (Lv.1–2) → 2 (Lv.3–6) → 3 (Lv.7–8).
Types unlocked by level: Speciality (Lv.1) → Nationality (Lv.3) → Teams (Lv.5) → Age (Lv.7).

| Strategy | Bonus | Configuration |
|--------|-------|---------------|
| Specialist | +5% for riders of a chosen specialty | Player's choice |
| National Pride | +5% for riders of a chosen nationality | Player's choice |
| Team Chemistry | +5% for riders of a chosen UCI team | Player's choice |
| Age (Young/Veteran) | +5% for riders in a chosen age bracket | Player's choice |

Bonuses are **additive**. Example: National Pride (Belgium) + Specialist (Sprinter) = +10%.

**Timing:**
- In **Round 1** of a phase: strategy changes take effect **immediately**
- In **Round 2+**: strategy changes are **pending** and take effect at the next payday

---

## 9. Sponsors

**1 sponsor per team**, gated by level only (no eligibility conditions).

### 6 tiers, 13 sponsors

| Tier | Level | Budget/phase | Sponsors | Orientation |
|------|-------|-------------|----------|-------------|
| T1 | 1 | 250,000 EUR | Lotto | Neutral |
| T2 | 2 | 350,000 EUR | Astana | Neutral |
| T3 | 3 | 450,000 EUR | Groupama-FDJ (FR), Movistar (ES) | GC |
| T3 | 3 | 450,000 EUR | Alpecin-Deceuninck (BE/NL), Uno-X (DK/NO) | One-Day |
| T4 | 4 | 750,000 EUR | Ineos Grenadiers (GB), Decathlon AG2R (FR) | GC |
| T4 | 4 | 750,000 EUR | Soudal Quick-Step (BE), Lidl-Trek (US/IT) | One-Day |
| T5 | 6 | 1,000,000 EUR | Visma-Lease a Bike (prestige), Red Bull-Bora (regular) | GC |
| T6 | 8 | 1,250,000 EUR | UAE Team Emirates | Neutral |

### Race result bonuses

Sponsors credit **bonuses** when a team rider achieves a qualifying race result.

**T1–T4: 3 bonus lines + multipliers**

Each sponsor has a threshold and amount for 3 categories:
- **GC Bonus** — general classification in a stage race / grand tour
- **One-Day Bonus** — classics and monuments
- **Stage Bonus** — individual stage win / top X

Multipliers (T1–T4 only):
- **×2** for a Monument or Grand Tour
- **×1.25** if the rider's nationality matches the sponsor's nationality
- Cumulative: Monument + nationality = ×2.5

**T5–T6: explicit prestige bonuses (no nationality multiplier)**

Separate amounts for One-Day / Monument / Stage Race GC / Grand Tour GC / Stage.
Only multiplier: ×2 for a Grand Tour stage.

### Sponsor changes

- Can be changed at any time
- In **Round 1** of a phase: sponsor change takes effect **immediately**
- In **Round 2+**: sponsor change is **pending** and takes effect at the next payday
- The current sponsor remains active for race bonuses until the change takes effect

### First sponsor (onboarding)

- No sponsor at team creation
- Player selects their first sponsor → immediate payment (= first payday)
- Lotto (T1) recommended by default

---

## 10. WT Phases & Payday

### 9 phases aligned to the World Tour calendar

| # | Phase | Approx. Period | Auction Rounds |
|---|-------|----------------|----------------|
| 1 | Season Start | Jan 15 – Mar 1 | Jan 15/16/17 |
| 2 | Classics Part 1 | Mar 2 – Apr 1 | Mar 2/3/4 |
| 3 | Classics Part 2 | Apr 2 – May 1 | Apr 2/3/4 |
| 4 | Giro d'Italia | May 2 – Jun 1 | May 2/3/4 |
| 5 | Pre-Tour | Jun 2 – Jul 1 | Jun 2/3/4 |
| 6 | Tour de France | Jul 2 – Jul 27 | Jul 2/3/4 |
| 7 | Post-Tour | Jul 28 – Aug 18 | Jul 28/29/30 |
| 8 | La Vuelta | Aug 19 – Sep 15 | Aug 19/20/21 |
| 9 | End of Season | Sep 16 – Oct 18 | Sep 16/17/18 |

> **Note:** The commissioner can edit round dates for any auction round before it closes.

### Payday (phase confirmation)

At the start of each phase, the player **confirms** their configuration:
1. Adjust sponsor, releases, strategies — no money movement yet
2. Click "Confirm"
3. Calculation: `treasury += sponsor_budget − sum(salaries)`
4. If treasury < −10,000 → bankruptcy cascade (§4.5)
5. Player enters auction mode

**Each player confirms independently** — no global payday.

**Pending changes activation:** at payday, sponsor and strategy changes that were pending (set in Round 2+) take effect. Then the new sponsor budget and strategy bonuses apply for the rest of the phase.

---

## 11. Game Constants (summary)

| Constant | Value |
|----------|-------|
| Starting treasury | 200,000 EUR |
| Default sponsor | Lotto T1, 250,000 EUR/phase (fixed) |
| Auction = monthly salary | Yes — not a one-time purchase |
| Monthly salary | max(5,000, floor(PCS_pts × 2,000 / 12 / 100) × 100) |
| Salary floor | 5,000 EUR/month |
| Release fee | None (phase salary not refunded) |
| Bankruptcy tolerance | −10,000 EUR |
| Bankruptcy: releases first | Highest cumulative XP rider |
| Bid increment | 100 EUR (multiples of 100) |
| Max slots | 6 (Lv.1) → 12 (Lv.7–8) |
| Max strategies | 1 (Lv.1–2) → 2 (Lv.3–6) → 3 (Lv.7–8) |
| Rider pool | Top 600 PCS global (rolling 12 months) |
| XP Level 8 (max) | 2,400 |
| Max players per league | 20 |
| Sponsor / strategy Round 1 | Immediate effect |
| Sponsor / strategy Round 2+ | Pending — takes effect at next payday |
| Release effect | Start of next phase (except bankruptcy: immediate) |
| Release cooldown | 7 days (no one can bid the rider during this window) |
| Round resolution | Auto on consensus, or manual force-resolve from Status tab |
| GT Tactics per Grand Tour | 1 of each type (5 total) |
| Commissioner round dates | Editable at any time before round closes |

---

## 12. Anti-Runaway System

> Spec complète : `docs/plans/2026-04-23-anti-runaway-system-design.md`
> Implémenté sur `main` — 2026-04-24

3 mécanismes toujours actifs (league-wide, pas d'opt-in commissioner) pour limiter les écarts structurels entre le leader et les joueurs hors-podium.

### 12.1 Remontada Boost (Mécanisme 1)

- **Scope** : Grand Tours uniquement (Giro, Tour de France, Vuelta).
- **Éligibilité** : joueurs classés rank 4+ dans la ligue au moment du trigger. Inactif si la ligue a <4 joueurs.
- **Trigger** : le joueur A dépasse le joueur B dans le classement ligue → boost déclenché pour A.
- **Contrainte anti-ping-pong** : 1 trigger max par paire ordonnée A→B par GT. Reset au GT suivant.
- **Reward** : tous les points de A pendant les **3 prochaines stages effectives** sont multipliés par **1.5x**.
- **Cumul** : si A déclenche un autre overtake pendant son boost, le timer se refresh à 3 stages (pas de stacking — reste 1.5x).
- **UX** : banner 🔥 "Remontada Boost active" affiché sur la sub-tab GT de la page Team. Indicateur passif 🔥 visible dans le classement ligue.

### 12.2 Co-Unlock Rule (Mécanisme 2)

- **Règle** : un joueur peut enchérir sur un coureur uniquement si **≥2 joueurs de la ligue** ont le niveau requis pour accéder à ce coureur.
- **Mapping** (rang PCS → niveau requis) : identique au pool gating (§3).
- **Grandfathering forward-only** : contrats existants au déploiement conservés. La règle s'applique uniquement aux nouvelles enchères.
- **Release exclusif** : si le seul joueur éligible release un coureur, celui-ci passe en état "locked" jusqu'à ce qu'un 2e joueur atteigne le niveau.
- **UX** : coureurs locked visibles uniquement pour les joueurs éligibles, avec icône cadenas et message "Unlock when N more players reach Lv.X".

### 12.3 Level Curve Stretch (Mécanisme 3)

- **Principe** : les seuils XP de Lv.6, Lv.7 et Lv.8 sont relevés pour ralentir la progression end-game.
- **Nouveaux seuils** : Lv.6 = 1 200 XP | Lv.7 = 1 800 XP | Lv.8 = 2 400 XP (Lv.1–5 inchangés).
- **Sponsor remapping** : T4 avancé de Lv.5 → Lv.4 ; T5 avancé de Lv.7 → Lv.6 ; T6 reste à Lv.8.
- **Grandfathering** : aucun joueur ne régresse. Le niveau actuel est conservé ; seule la barre de progression vers le prochain niveau s'ajuste.
- **Effet** : les joueurs restent clustered aux niveaux 4–6 plus longtemps, réduisant l'asymétrie slots/budget/pool entre leader et laggards.

---

## 13. Grand Tour Tactics

> Implemented: 2026-05-08 (PR #25)
> Spec: `docs/archive/plans-completed/2026-05-08-gt-tactics-design.md`

5 tactical abilities available **only during Grand Tours** (Giro, Tour de France, Vuelta). Each tactic modifies scoring for specific riders on specific stages.

### Available Tactics

| Tactic | Effect | Target | Limit |
|--------|--------|--------|-------|
| **Unleash** | ×1.5 XP for domestiques | All non-GC riders on roster | 1 per GT |
| **Overdrive** | ×2.0 XP for stage hunters | 1 specific rider | 1 per GT |
| **Nemesis GC** | PvP duel on GC classification | 1 rival team's GC rider | 1 per GT |
| **Nemesis Sprint** | PvP duel on sprint classification | 1 rival team's sprinter | 1 per GT |
| **Call the Bus** | Bench riders contribute XP | All bench riders | 1 per GT |

### Placement rules

- Tactics are placed **before a stage starts** (11:00 CET cutoff on the stage day).
- Each tactic can be used **once per Grand Tour** (5 uses total per player per GT).
- Nemesis tactics require selecting a rival team and a specific rider as the duel target.
- Effects apply for the **duration of the selected stage** only.

### Scoring integration

- Tactic modifiers are applied **after** strategy bonuses, **before** Remontada Boost.
- Traceability: `rider_xp_daily` records `role_mult` and `gt_classif_bonus` per scoring event.
- Nemesis duels are resolved at stage scoring via the internal `resolve_nemesis_for_stage` RPC.

---

## 14. Admin tools

### grant_xp (commissioner / admin)

- The commissioner can manually grant XP to a team via the `grant_xp` RPC (admin tool).
- Each adjustment is recorded in `team_xp_adjustments` with type, amount, and reason for full traceability.
- Used for compensating bugs, pre-season tournament rewards, or manual catch-up after PCS sync issues.

---

## 15. Late Join (Mid-Season)

A player can join an **active league** (one that has already started auctions).

| Rule | Value |
|------|-------|
| Starting XP | Average of existing teams' cumulative XP |
| Starting treasury | Average of existing teams' treasury (rounded to nearest 100) |
| Starting level | Computed from average XP (`compute_level`) |
| Sponsor | None — player must select one (locked until next phase if Round 1 closed) |
| Strategies | None — player configures after joining |

- The new team inherits the league's progression so they are competitive immediately.
- Treasury is rounded to the nearest 100 (because bids must be multiples of 100).
- No retroactive race results — XP starts accumulating from the join date.

---

## 16. GT Rescue (DNF Refund/Replace)

During Grand Tours, riders can abandon (DNF). The GT Rescue system gives players options when this happens.

### Trigger
- A rider in a player's GT squad is detected as DNF during stage scoring.
- The `dnf_stage` is recorded on the `gt_squad` entry.

### Options

| Option | Effect | Timing |
|--------|--------|--------|
| **Refund** | Claim salary refund → contract auto-released (immediate, no cooldown) | Anytime during the GT after DNF |
| **Replace** | Place an emergency bid on a new rider | During GT rescue window |

### Emergency bids
- Same rules as regular bids: min = rider's market salary, multiples of 100.
- Budget validation: `treasury >= bid amount`.
- Only riders **not already in the league** can be emergency-bid.
- The emergency contract has `phase_recruited_id` set (same release lock as regular contracts).

### Refund
- On refund claim: contract is **immediately released** (no 7-day cooldown — this is an exception to §5).
- The phase salary is credited back to treasury.

---

## 17. Sponsor GT Goals (V1b)

> Applies to **T4 sponsors** (Ineos, Decathlon AG2R, Soudal Quick-Step, Lidl-Trek).

T4 sponsors offer **one-time bonus goals** during Grand Tours, on top of regular race-result bonuses (§9).

### Structure
- Each T4 sponsor defines a set of GT-specific goals (e.g., "Podium GC final", "Stage win").
- Goals are **role-gated**: only riders with the matching GT role (GC leader, stage hunter, domestique) can trigger a goal.
- Goals follow a "best of two" tiered structure: if a higher-tier goal is completed, the lower-tier payout is replaced (not cumulated).
- Each goal pays **once per GT** — tracked in `sponsor_goal_completions`.

### Evaluation
- Goals are evaluated after each stage scoring.
- Payout is credited to treasury immediately upon goal completion.
