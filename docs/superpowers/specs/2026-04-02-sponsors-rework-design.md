# Sponsors Rework — Design Spec

**Date:** 2026-04-02
**Status:** Validated (brainstorming complete)
**Scope:** Replace the entire sponsor system with a simplified model

---

## 1. Problem Statement

The current sponsor system is too complex for new players:

- **2 sponsor slots** (secondary + principal) with different tier restrictions
- **Eligibility conditions** that cross 3 axes (nationality × specialty × race results) — players can't select a sponsor until all conditions are met
- **Sponsor-policy entanglement** — can't deactivate a policy if your sponsor depends on it
- **Lotto escalation** (200K first phase → 300K later) requires special-case code (`first_phase_budget`, `payments_count`)
- **Phase-based pending changes** — sponsor changes outside auction windows are queued until next phase

**Goal:** A system where every sponsor is always selectable (gated only by level), with a single strategic choice per tier, and bonuses that are easy to understand.

---

## 2. New Sponsor Model

### Core Principles

1. **1 sponsor per team** — no more secondary/principal slots
2. **No eligibility conditions** — only level-gated
3. **Fixed base income** — guaranteed, known before auctions
4. **Bonus from race results** — replaces old rider bonus formula (`max(0, pts × 1500 - salary)`)
5. **Immediate change** — switch sponsor anytime, effect next day (daily finance)
6. **No Lotto escalation** — flat 250K always

### Sponsor Table (6 Tiers, 13 Sponsors)

| Tier | Level | Base/mois | Sponsors | Orientation |
|------|-------|-----------|----------|-------------|
| T1 | 1 | 250K | Lotto | Neutre |
| T2 | 2 | 350K | Astana | Neutre |
| T3 | 3 | 450K | Groupama (FR), Movistar (ES) | GC |
| T3 | 3 | 450K | Alpecin (BE/NL), Uno-X (DK/NO) | One-Day |
| T4 | 5 | 650K | Ineos (GB), Decathlon (FR) | GC |
| T4 | 5 | 650K | Soudal Quick-Step (BE), Lidl-Trek (US/IT) | One-Day |
| T5 | 7 | 1M | Visma | GC — "Le pari prestige" |
| T5 | 7 | 1M | Red Bull-Bora | GC — "Le régulier" |
| T6 | 8 | 1.25M | UAE Group | Neutre — sponsor ultime |

---

## 3. Bonus System

### 3.1 Race Result Categories

| Catégorie | Exemples | Type |
|-----------|----------|------|
| **One-Day Race** | Strade Bianche, Amstel Gold, Flèche Wallonne, E3, Gand-Wevelgem | Classique |
| **Monument** | Milan-San Remo, Tour des Flandres, Paris-Roubaix, Liège-Bastogne-Liège, Il Lombardia | Prestige One-Day |
| **Stage Race GC** | Paris-Nice, Tirreno-Adriatico, Dauphiné, Tour de Suisse, Pays Basque | GC |
| **Grand Tour GC** | Giro d'Italia, Tour de France, Vuelta a España | Prestige GC |
| **Étape (Stage Race)** | Individual stage win/result in any stage race | Étape |
| **Étape (Grand Tour)** | Individual stage win/result in Giro/Tour/Vuelta | Étape prestige |

### 3.2 T1-T4: Three-Line Format + Multipliers

Each sponsor displays 3 bonus lines:
1. **Bonus GC** — triggers on stage race GC and grand tour GC results
2. **Bonus One-Day** — triggers on classic and monument results
3. **Bonus Étape** — triggers on individual stage results in any stage race or grand tour

**Multipliers (always applied on all 3 lines):**
- **×2** if the result is in a **Monument** (for One-Day/Étape lines) or **Grand Tour** (for GC/Étape lines)
- **×1.5** if the rider's nationality matches the sponsor's nationality
- Multipliers stack multiplicatively: Monument + nationality = ×2 × 1.5 = ×3

**Stage threshold progression:** Top 10 (T1-T2) → Top 5 (T3) → Podium (T4)

**Note:** T1 and T2 have no nationality (×1.5 never applies).

#### T1 — Lotto (250K, Level 1)

| Résultat | Seuil | Bonus |
|----------|-------|-------|
| GC | Top 25 | 3K |
| One-Day | Top 25 | 3K |
| Étape | Top 10 | 2K |

×2 Monument/Grand Tour (all lines) — Nationalité: aucune

#### T2 — Astana (350K, Level 2)

| Résultat | Seuil | Bonus |
|----------|-------|-------|
| GC | Top 20 | 5K |
| One-Day | Top 20 | 5K |
| Étape | Top 10 | 3K |

×2 Monument/Grand Tour (all lines) — Nationalité: aucune

#### T3 — Groupama (FR) / Movistar (ES) — GC-oriented (450K, Level 3)

| Résultat | Seuil | Bonus |
|----------|-------|-------|
| GC | Top 15 | **20K** |
| One-Day | Top 15 | 5K |
| Étape | Top 5 | 5K |

×2 Monument/Grand Tour (all lines) — ×1.5 nationalité: FR / ES

#### T3 — Alpecin (BE/NL) / Uno-X (DK/NO) — One-Day-oriented (450K, Level 3)

| Résultat | Seuil | Bonus |
|----------|-------|-------|
| GC | Top 15 | 5K |
| One-Day | Top 15 | **10K** |
| Étape | Top 5 | 5K |

×2 Monument/Grand Tour (all lines) — ×1.5 nationalité: BE/NL / DK/NO

#### T4 — Ineos (GB) / Decathlon (FR) — GC-oriented (650K, Level 5)

| Résultat | Seuil | Bonus |
|----------|-------|-------|
| GC | Top 10 | **40K** |
| One-Day | Top 10 | 10K |
| Étape | Podium | 10K |

×2 Monument/Grand Tour (all lines) — ×1.5 nationalité: GB / FR

#### T4 — Soudal Quick-Step (BE) / Lidl-Trek (US/IT) — One-Day-oriented (650K, Level 5)

| Résultat | Seuil | Bonus |
|----------|-------|-------|
| GC | Top 10 | 10K |
| One-Day | Top 10 | **20K** |
| Étape | Podium | 10K |

×2 Monument/Grand Tour (all lines) — ×1.5 nationalité: BE / US/IT

### 3.3 T5-T6: Four-Line Format (No Nationality)

At T5 and above, the 4 result categories are displayed explicitly with different thresholds, plus a stage line. No nationality multiplier.

#### T5 — Visma — "Le pari prestige" (1M, Level 7)

| Résultat | Seuil | Bonus |
|----------|-------|-------|
| One-Day | Top 5 | 25K |
| Monument | Podium | **75K** |
| Stage Race GC | Top 5 | 25K |
| Grand Tour GC | Podium | **75K** |
| Étape | Victoire | 15K |

Étape ×2 si Grand Tour → 30K

**Philosophy:** High risk / high reward. Podium on prestige events pays massively (75K), but top 5 on regular events pays modestly (25K).

#### T5 — Red Bull-Bora — "Le régulier" (1M, Level 7)

| Résultat | Seuil | Bonus |
|----------|-------|-------|
| One-Day | Top 5 | 30K |
| Monument | Top 5 | **50K** |
| Stage Race GC | Top 5 | 30K |
| Grand Tour GC | Top 5 | **50K** |
| Étape | Victoire | 15K |

Étape ×2 si Grand Tour → 30K

**Philosophy:** Consistent income. Top 5 everywhere pays well. Less upside than Visma on podium finishes, but more reliable.

#### T5 Strategic Dilemma

| Scénario | Visma | Red Bull |
|----------|-------|----------|
| Rider 2e du Tour (GC) | **75K** | 50K |
| Rider 4e du Tour (GC) | 25K | **50K** |
| Rider 3e Paris-Roubaix | **75K** | 50K |
| Rider 5e Paris-Roubaix | 25K | **50K** |
| Rider 4e Amstel Gold | 25K | **30K** |
| 3 riders top 5 classiques | 75K | **90K** |
| 1 rider podium Giro | **75K** | 50K |

**Visma wins with elite podium riders. Red Bull wins with deep rosters.**

#### T6 — UAE Group — Sponsor Ultime (1.25M, Level 8)

| Résultat | Seuil | Bonus |
|----------|-------|-------|
| One-Day | Victoire | 50K |
| Monument | Podium | **100K** |
| Stage Race GC | Victoire | 50K |
| Grand Tour GC | Podium | **100K** |
| Étape | Victoire | 25K |

Étape ×2 si Grand Tour → 50K

**Philosophy:** Only victories and podiums matter. The biggest bonuses in the game (100K for a GT/Monument podium) but the hardest thresholds to hit.

---

## 4. What This Replaces

### Removed Mechanics

| Old Mechanic | Status | Replaced By |
|-------------|--------|-------------|
| `max(0, pts × 1500 - salary)` rider bonus | **DELETED** | Sponsor result bonuses |
| `CONVERSION_RATE_EUR_PER_PCS` env var | **DELETED** | Fixed bonus amounts per sponsor |
| Secondary/Principal sponsor slots | **DELETED** | 1 sponsor per team |
| Sponsor eligibility conditions (nationality + specialty + result) | **DELETED** | Level-only gating |
| `first_phase_budget` / `payments_count` (Lotto escalation) | **DELETED** | Flat 250K always |
| Sponsor-policy entanglement | **DELETED** | Fully decoupled |
| Phase-based pending sponsor changes | **DELETED** | Immediate change, daily finance |
| `team_sponsors.slot` column | **DELETED** | No more slots |
| `team_sponsors.pending_sponsor_id` | **DELETED** | No more pending |
| `team_sponsors.effective_phase_id` | **DELETED** | No more phase dependency |
| `sponsors.specialty_condition` | **DELETED** | No more conditions |
| `sponsors.nationality_condition` | **DELETED** | Nationality is now just a bonus multiplier |
| `sponsors.result_condition` | **DELETED** | Results trigger bonuses, not eligibility |

### New Mechanics

| New Mechanic | Description |
|-------------|-------------|
| Daily sponsor income | `base_amount / 30` credited each day |
| Sponsor result bonus | Credited on day of race result |
| ×2 Monument/Grand Tour multiplier | Applies to T1-T4 bonus amounts |
| ×1.5 nationality multiplier | Applies to T1-T4 when rider nationality matches sponsor |
| Stage bonus + ×2 Grand Tour | Separate line for stage results |
| Sponsor switch = next day | Change sponsor anytime, new sponsor active starting tomorrow |
| Auto-assignment | Lotto auto-assigned at L1, Astana auto-assigned at L2 |

### Unchanged Mechanics

| Mechanic | Status | Detail |
|----------|--------|--------|
| XP calculation | **UNCHANGED** | `xp = pcs_points × (1 + Σ policy_bonuses)` — XP is separate from financial bonuses |
| Salary formula | **UNCHANGED** | `max(5000, floor(pcs_points × 2000 / 12 / 100) × 100)` |

### Sponsor Switch Timing Rule

- **Change takes effect the next day** (not immediately)
- Race results on the day of the switch use the **old sponsor** for bonus calculation
- Starting the next day: daily base income and race bonuses use the **new sponsor**
- This avoids mid-day sponsor gaming (switching before a race result is imported)

### Auto-Assignment by Level

| Level | Default Sponsor | Player Action |
|-------|----------------|---------------|
| 1 | Lotto (T1, 250K) | Auto-assigned, no action needed |
| 2 | Astana (T2, 350K) | Auto-upgraded, no action needed |
| 3+ | None | Player must select a sponsor before playing (home page prompt) |

When a league is created with a starting level ≥ 3, the player sees a "Select your sponsor" card on the home page before they can participate in auctions.

---

## 5. Database Schema Changes

### Modified Tables

**`sponsors`** — Simplified columns:
- `id`, `name`, `slug`, `tier` (1-6), `unlock_level`, `monthly_budget`
- `orientation` ('gc', 'one_day', 'neutral')
- `nationality` (nullable, e.g. 'FR', 'ES', 'BE/NL', 'DK/NO', 'GB', 'US/IT')
- `bonus_gc` (integer, bonus amount for GC result)
- `bonus_one_day` (integer, bonus amount for One-Day result)
- `bonus_stage` (integer, bonus amount for stage result)
- `gc_threshold` (integer, e.g. 25, 20, 15, 10)
- `one_day_threshold` (integer, same)
- `stage_threshold` (integer, e.g. 10, 10, 5, 3)
- `has_explicit_prestige` (boolean, default false — true for T5-T6)
- `bonus_monument` (nullable integer, for T5-T6 explicit amounts)
- `bonus_grand_tour` (nullable integer, for T5-T6 explicit amounts)
- `monument_threshold` (nullable integer, for T5-T6)
- `grand_tour_threshold` (nullable integer, for T5-T6)

**Removed columns:** `slot`, `specialty_condition`, `nationality_condition`, `result_condition`, `first_phase_budget`

**`team_sponsors`** — Simplified:
- `id`, `team_id`, `sponsor_id`, `activated_at`
- **Removed:** `slot`, `status`, `pending_sponsor_id`, `effective_phase_id`, `payments_count`
- **Constraint:** `UNIQUE(team_id)` — one sponsor per team

### New Table: `sponsor_bonuses`

Log of sponsor bonus payments (replaces rider_revenue in treasury_log):
- `id`, `team_id`, `sponsor_id`, `rider_id`, `race_slug`, `race_date`
- `result_type` ('gc', 'one_day', 'monument', 'grand_tour', 'stage')
- `rider_rank` (integer, the rider's finishing position)
- `base_bonus` (integer, raw bonus amount)
- `multiplier` (decimal, 1.0 / 1.5 / 2.0 / 3.0)
- `final_bonus` (integer, base × multiplier)
- `created_at`

---

## 6. Finance: Phase Model

Each of the 8 WT phases triggers one finance cycle. Same fixed amounts regardless of phase duration.

### Phase Income
```
phase_sponsor_base = sponsor.monthly_budget
```
Credited once at the start of each phase (via `phase-finance` pipeline).

### Race Day Bonus
When a race result is imported (Pipeline B: post-race):
1. For each contracted rider with a qualifying result:
2. Determine result type (GC / One-Day / Monument / Grand Tour / Stage)
3. Check if rider's rank ≤ sponsor's threshold for that type
4. If yes: calculate `base_bonus × multiplier`
   - multiplier = 1.0 (default)
   - multiplier × 2.0 if Monument or Grand Tour (T1-T4 only, T5-T6 have explicit amounts)
   - multiplier × 1.5 if rider nationality matches sponsor nationality (T1-T4 only)
5. Credit to treasury, log in `sponsor_bonuses` and `treasury_log`

### Phase Salary Deduction
```
phase_salary = Σ(locked_salary)  -- sum of all contracted riders
```
Deducted once at the start of each phase.

### Net Phase Cash Flow
```
net = phase_sponsor_base - phase_salary + race_bonuses_during_phase
```

---

## 7. Race Classification

Each race must be classified for bonus calculation. Classification sources:

### One-Day Races (Classics)
Strade Bianche, Milano-Torino, Omloop Het Nieuwsblad, Kuurne-Bruxelles-Kuurne, Grand Prix Cycliste de Québec, Grand Prix Cycliste de Montréal, Bretagne Classic, Eschborn-Frankfurt, Amstel Gold Race, Flèche Wallonne, Clásica San Sebastián, E3 Saxo Classic, Gent-Wevelgem, Dwars door Vlaanderen, and other WT one-day races.

### Monuments (5 races)
Milan-San Remo, Tour des Flandres, Paris-Roubaix, Liège-Bastogne-Liège, Il Lombardia.

### Stage Races (GC = general classification result)
Paris-Nice, Tirreno-Adriatico, Volta a Catalunya, Tour du Pays Basque, Tour de Romandie, Critérium du Dauphiné, Tour de Suisse, and other WT stage races.

### Grand Tours (GC = general classification result)
Giro d'Italia, Tour de France, Vuelta a España.

### Stage Results
Any individual stage within a stage race or grand tour. The result is the stage classification (not GC).

**Note:** Race classification is already partially implemented via `race_class` in `race_results` table and the slug-to-class mapping in `sync_race.py`. This needs to be extended with a `monument` boolean and ensure all WT races are classified.

---

## 8. UI Impact

### Sponsor Selection Page
- Single list of sponsors grouped by tier
- Locked sponsors (level too low) shown at 33% opacity with level badge
- Current sponsor highlighted
- Each sponsor card shows:
  - Name + logo
  - Base amount
  - Bonus table (2-3 lines for T1-T4, 5-6 lines for T5-T6)
  - Multiplier rules as footnote
  - "Select" button (enabled if level sufficient)

### Budget/Treasury Page
- Daily income breakdown: sponsor base + bonuses earned
- No more "next phase" pending state

### Notification on Sponsor Change
- Simple confirmation: "Sponsor changed to [name]. New income starts tomorrow."

---

## 9. Migration Strategy

1. Create new `sponsors` seed data (13 sponsors with new schema)
2. Migrate `team_sponsors` to single-sponsor model (keep highest tier active sponsor)
3. Drop unused columns
4. Update `treasury_log` types (remove `rider_revenue`, add `sponsor_bonus`)
5. Create `sponsor_bonuses` table
6. Update scoring pipeline to use new bonus calculation
7. Remove old monthly_finance sponsor payment logic, replace with daily

---

## 10. Out of Scope (Future Sessions)

See `docs/plans/2026-04-02-game-simplification-backlog.md` for full list:
- Policy rework (cooldown system)
- Release rider simplification (immediate + 2K fee)
- Auction phase decoupling
- Bankruptcy adaptation to daily finance
- Pipeline refactoring
