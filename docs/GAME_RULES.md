# WattHunter — Game Rules

> **Living document** — Updated with every rule change.
> Source of truth for implemented and planned game mechanics.
> Last updated: 2026-06-30

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
| Game mode | `manager` (default) or `classic` — see §19 |

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
Monthly salary = max(5,000, floor(PCS_points_1yr × 2,500 / 12 / 1,000) × 1,000)
Floor: 5,000 EUR/month | Rounded down to nearest 1,000 | No cap
```

**Examples:**
- 114 pts PCS (#600) → 285K/yr → **23,000 EUR/month**
- 400 pts PCS (#100) → 1.0M/yr → **83,000 EUR/month**
- 2,216 pts PCS (#5) → 5.54M/yr → **461,000 EUR/month**

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
| Minimum increment | 1,000 EUR |
| Multiples | Bids must be multiples of 1,000 EUR |
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

Outside Grand Tours:
```
Rider XP = daily_PCS_points × (1 + sum of active strategy bonuses)
```

Grand Tour stages (squad riders only — non-squad contracted riders score 0):
```
Rider XP = (PCS_points × role_mult × (1 + strategy_bonus)
            + classif_bonus + breakaway_bonus) × nemesis_modifier
```
- **role_mult** (Spec A, 2026-06-02): a rider has **exactly one role**, so `role_mult` takes
  exactly one value — the per-role multipliers never stack. gc_leader / climber ×1.5;
  tt_specialist ×2.0 on ITT only; sprinter ×1.5 only on flat/hilly stages (profile p1/p2/p3);
  stage_hunter ×1.5 only in the breakaway (≥30 km); **underdog ×clamp(pcs_rank/100, 1, 4)**
  (Spec B — mutually exclusive with the roles above; see §14); domestique ×1.0.
  **GC final → ×1.0 for all roles.**
- **classif_bonus** (daily gc/points/kom/youth): role-matched only — gc_leader→GC ×2
  (and Youth ×1.5), sprinter→Points ×2, climber→KOM ×2; all other roles 0.
- **breakaway_bonus**: stage_hunter only, +1 XP per 10 km in the break (no cap), additive.
- **Final jerseys**: GC final = raw PCS points ×1.0. Points/KOM/Youth finals = rank scale
  80/20/10 (GT) · 40/10/5 (1-week, P3) × role mult (Points→sprinter ×2, KOM→climber ×2,
  Youth→gc_leader ×1.5; ×1.0 otherwise).

Team XP = sum of XP from all roster riders

### Level progression (8 levels aligned to WT phases)

| Level | WT Phase | XP Required | Slots | Max Strategies | PCS Pool | Strategy Unlocked | Sponsor Unlocked |
|-------|----------|-------------|-------|--------------|----------|-----------------|-----------------|
| 1 | Season Start | 0 | 6 | 1 | #300–600 | Speciality | Lotto T1 (250K) |
| 2 | Classics P1 | 25 | 7 | 1 | #200–600 | — | Astana T2 (350K) |
| 3 | Classics P2 | 150 | 8 | 2 | #100–600 | Nationality | T3 · 450K (×4) |
| 4 | Giro | 350 | 9 | 2 | #30–600 | — | T4 · 750K (×4) |
| 5 | Pre-Tour | 600 | 10 | 2 | #20–600 | Teams | T4 · 750K (×4) |
| 6 | Tour de France | 1,200 | 11 | 2 | #10–600 | — | T5 · 1M (×2) |
| 7 | Post-Tour | 2,600 | 12 | 3 | #4–600 | Age | T5 · 1M (×2) |
| 8 | La Vuelta | 5,000 | 12 | 3 | #1–600 | — | T6 UAE · 1.25M |

### In-app scoring documentation (Spec A A8)

A summary of the rules above is rendered to players on the Race Team page via
the `<ScoringDocCard />` component (`apps/web/components/scoring-doc-card.tsx`).
It covers:

- Daily multipliers (gc/points/kom ×2 matched, youth ×1.5) — see §7 + A2.
- Finals (GC ×1.0, Points/KOM ×2, Youth ×1.5; barème 80/20/10 GT · 40/10/5 1-sem) — see A2.
- Stage Hunter (×1.5 in breakaway ≥30 km + 1pt/10 km additive, ×1.0 elsewhere) — see A3.
- Sprinter profile gating (×1.5 only on p1/p2/p3) — see A4.
- Nemesis profile gating (Sprint p1-p3, GC p3-p5) — see A7.

The values are not duplicated in the component — constants stay in §11.

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
- **×1.20** if the rider's nationality matches the sponsor's nationality
- Cumulative: Monument + nationality = ×2.4

**T5–T6: prestige bonuses (no nationality multiplier)**

No nationality multiplier. Since Spec C (2026-06-03), T5 mirrors the T4 base barème with prestige applied at runtime — see §11 (Sponsor bonus barème) for the authoritative amounts. T6 (UAE) is unchanged/deferred.

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
| Monthly salary | max(5,000, floor(PCS_pts × 2,500 / 12 / 1,000) × 1,000) |
| Salary floor | 5,000 EUR/month |
| Release fee | None (phase salary not refunded) |
| Bankruptcy tolerance | −10,000 EUR |
| Bankruptcy: releases first | Highest cumulative XP rider |
| Bid increment | 1,000 EUR (multiples of 1,000) |
| Max slots | 6 (Lv.1) → 12 (Lv.7–8) |
| Max strategies | 1 (Lv.1–2) → 2 (Lv.3–6) → 3 (Lv.7–8) |
| Rider pool | Top 600 PCS global (rolling 12 months) |
| XP Level 8 (max) | 5,000 |
| Max players per league | 20 |
| Sponsor / strategy Round 1 | Immediate effect |
| Sponsor / strategy Round 2+ | Pending — takes effect at next payday |
| Release effect | Start of next phase (except bankruptcy: immediate) |
| Release cooldown | 7 days (no one can bid the rider during this window) |
| Co-Unlock threshold | max(2, ceil(30% of league teams)) — see §12.1 |
| Round resolution | Auto on consensus, or manual force-resolve from Status tab |
| GT Tactics per race | Varies by tactic and race kind (see §13 — Tactic usage per race) |
| Commissioner round dates | Editable at any time before round closes |

- **GT scoring multipliers** (Spec A, 2026-06-02): daily classif matched ×2 (youth ×1.5);
  GC final ×1.0 for all roles; sprinter gated to profile p1/p2/p3; stage_hunter breakaway
  threshold 30 km, distance bonus +1 XP / 10 km (no cap, additive); final secondary jersey
  scale 80/20/10 (GT) · 40/10/5 (1-week, P3).

### Tactic gating profiles (Spec A A7)
- `NEMESIS_SPRINT_PROFILES = {p1, p2, p3}` (flat + hilly — anything but mountain).
- `NEMESIS_GC_PROFILES     = {p3, p4, p5}` (hilly-uphill + mountain — where the GC is decided).
- Profile source : `stage_profiles` table, seeded by `python run_pipeline.py startlists --race "<slug>"`.
- Source code : `supabase/migrations/20260603000100_place_tactic_profile_gating.sql`.

### Final secondary classifications scale (Spec A A2/A9)
- GT      : `[80, 20, 10]` (ranks 1 / 2 / 3 base XP, before role multiplier).
- 1-week  : `[40, 10, 5]`  (half-scale — shorter race, smaller payout).
- Multiplier on the matching role (×2 for points→sprinter, kom→climber; ×1.5 for youth→gc_leader); ×1.0 otherwise.
- Source : `services/pcs-sync/scoring.py:FINAL_SECONDARY_SCALE`.

### Sponsor bonus barème (Spec C, 2026-06-03)

A = base value for 1-week stage races and one-day races. B (Grand Tour / Monument) = A × 2, applied at runtime in `sponsor_bonus.py`.

| Tier | GC (Top N) | Stage (Top N) | One-day (Top N) | Goals |
|------|-----------|--------------|----------------|-------|
| T1 | 5k (Top 25) | 2.5k (Top 10) | 5k (Top 25) | no |
| T2 | 10k (Top 20) | 5k (Top 10) | 10k (Top 20) | no |
| T3 | 25k (Top 15) | 10k (Top 5) | 20k (Top 15) | no |
| T4 | 10k (Top 10) | 5k (Top 3) | 10k (Top 10) | yes |
| T5 | = T4 | = T4 | = T4 | yes |
| T6 (UAE) | deferred (unchanged) | — | — | — |

- **GT / Monument multiplier :** B = A × 2 computed at runtime (not stored). T6 untouched.
- **Nationality bonus :** ×1.20 (was ×1.25) for T1–T4 only; none for T5–T6.
- **Goals (T4+) :** per archetype (GC / Sprint / CLM / Stage-Hunter); 1-week base × 2 for GT; best-of per tierGroup per rider; sprinter stage-win goals gated to flat profiles (p1/p2/p3); Race Leader / youth / KOM jersey goals tracked.

---

## 12. Anti-Runaway System

> Spec complète : `docs/plans/2026-04-23-anti-runaway-system-design.md`
> Implémenté sur `main` — 2026-04-24

2 mécanismes toujours actifs (league-wide, pas d'opt-in commissioner) pour limiter les écarts structurels entre le leader et les joueurs hors-podium.

> **Note** : un 3e mécanisme anti-rattrapage (boost d'overtake) a existé mais a été supprimé le 2026-06-02. Il est remplacé à terme par Spec B (Underdog system).

### 12.1 Co-Unlock Rule (Mécanisme 1)

- **Règle** : un joueur peut enchérir sur un coureur uniquement si **un nombre dynamique de joueurs de la ligue** ont le niveau requis pour accéder à ce coureur.
- **Seuil dynamique** : `required = max(2, ceil(0.30 × nb_équipes_ligue))` — 30 % des équipes, plancher 2. Le plancher préserve le gate en petite ligue ; le seuil ne dépasse jamais le nombre d'équipes (pas de lock permanent). Source de vérité TS : `apps/web/lib/co-unlock.ts` `requiredTeamsToUnlock()`. Le RPC `place_bid` réplique la formule en SQL (`GREATEST(2, CEIL(0.30 * team_count))`) — les deux **doivent** rester synchronisés.
- **Mapping** (rang PCS → niveau requis) : identique au pool gating (§3).
- **Grandfathering forward-only** : contrats existants au déploiement conservés. La règle s'applique uniquement aux nouvelles enchères.
- **Release exclusif** : si moins de `required` joueurs éligibles restent après un release, le coureur repasse en état "locked" jusqu'à ce que le seuil soit de nouveau atteint.
- **UX** : coureurs locked visibles uniquement pour les joueurs éligibles, avec icône cadenas et message "Unlock when N more players reach Lv.X".

### 12.2 Level Curve Stretch (Mécanisme 2)

- **Principe** : les seuils XP de Lv.6, Lv.7 et Lv.8 sont relevés pour ralentir la progression end-game.
- **Nouveaux seuils** : Lv.6 = 1 200 XP | Lv.7 = 2 600 XP | Lv.8 = 5 000 XP (Lv.1–5 inchangés). *(Spec A A1, 2026-06-02 : L7/L8 relevés depuis 1 800 / 2 400.)*
- **Sponsor remapping** : T4 avancé de Lv.5 → Lv.4 ; T5 avancé de Lv.7 → Lv.6 ; T6 reste à Lv.8.
- **Grandfathering** : aucun joueur ne régresse. Le niveau actuel est conservé ; seule la barre de progression vers le prochain niveau s'ajuste.
- **Effet** : les joueurs restent clustered aux niveaux 4–6 plus longtemps, réduisant l'asymétrie slots/budget/pool entre leader et laggards.

---

## 13. Grand Tour Tactics

> Implemented: 2026-05-08 (PR #25)
> Spec: `docs/archive/plans-completed/2026-05-08-gt-tactics-design.md`

5 tactical abilities available **only during Grand Tours** (Giro, Tour de France, Vuelta). Each tactic modifies scoring for specific riders on specific stages.

### Available Tactics

| Tactic | Effect | Target |
|--------|--------|--------|
| **Unleash** | ×1.5 XP for domestiques | All non-GC riders on roster |
| **Overdrive** | ×2.0 XP for stage hunters **in the breakaway** | 1 specific rider |
| **Nemesis GC** | PvP duel on GC classification | 1 rival team's GC rider |
| **Nemesis Sprint** | PvP duel on sprint classification | 1 rival team's sprinter |
| **Call the Bus** | Bench riders contribute XP | All bench riders |

Per-race activation budget : see *Tactic usage per race (Spec A A9)* below.

### Tactic usage per race (Spec A A9)

Per `(team, race)`, the max activations of each tactic depend on the race kind:

| Tactic          | GT (Giro/Tour/Vuelta) | 1-week stage race |
|-----------------|-----------------------|-------------------|
| Unleash         | 2                     | 1                 |
| Overdrive       | 2                     | 1                 |
| Call the Bus    | 3                     | 2                 |
| Nemesis GC      | 1                     | 1                 |
| Nemesis Sprint  | 1                     | 1                 |

Enforced by trigger `enforce_tactic_usage_limit` reading `public.tactic_usage_limits`.

### Placement rules

- Tactics are placed **before a stage starts** (11:00 CET cutoff on the stage day).
- Nemesis tactics require selecting a rival team and a specific rider as the duel target.
- Effects apply for the **duration of the selected stage** only.

**Profile gating at activation (Spec A A7).** A Nemesis tactic can only be placed on a stage whose profile matches the duel type:
- Nemesis Sprint → stage profile must be in {p1, p2, p3}.
- Nemesis GC     → stage profile must be in {p3, p4, p5}.

The profile comes from `stage_profiles` (one row per stage_slug), seeded ahead of the race by `python run_pipeline.py startlists --race "<race_slug>"`. If the stage isn't seeded yet, placement returns "stage profile unknown".

### Scoring integration

- Tactic modifiers are applied **after** strategy bonuses.
- Traceability: `rider_xp_daily` records `role_mult` and `gt_classif_bonus` per scoring event.
- Nemesis duels are resolved at stage scoring via the internal `resolve_nemesis_for_stage` RPC.

**Nemesis duel outcomes** (multiplier applied to the rider's stage XP):

| Outcome       | Attacker            | Target              |
|---------------|---------------------|---------------------|
| attacker_won  | role_mult → ×2.0    | ×0.5                |
| target_won    | ×0.75               | ×1.25               |
| no_resolution | ×1.0                | ×1.0                |

- A target who **wins** its defensive duel keeps the ×1.25 reward (it is not clamped to ×1.0).
- Multiple enemy duels on the same rider/stage (rare): the **harshest** target multiplier wins (min).
- Underdog role boost and Nemesis are **mutually exclusive** — if a Nemesis duel affects a rider, the underdog `clamp(pcs_rank/100)` multiplier is not also applied (no `× nemesis × underdog` stacking).

---

## 14. Underdog (Spec B)

> Implémenté : 2026-06-05 (branche `claude/dreamy-bassi-e1ab35`)
> Spec : `docs/superpowers/specs/2026-06-01-spec-b-underdog-design.md`

Mécanisme anti-rattrapage complémentaire au Co-Unlock Rule et au Level Curve Stretch (§12). Il cible les équipes structurellement en retard et leur accorde 3 avantages temporaires, **tous réversibles** dès qu'elles rattrapent le leader.

### Éligibilité

- **Condition** : `cumulative_xp < 75 % de l'XP du leader de la ligue`.
- **Recalcul** : à chaque phase WT, via le RPC `recompute_underdog_eligibility(phase_id, year)` (pipeline Python `underdog-eligibility`).
- **Flag temps réel** : `teams.underdog_eligible boolean` (lu par les triggers et le payday).
- **Audit** : snapshot dans la table `underdog_eligibility` (une ligne par `(team_id, phase_id, year)`).

### Avantage 1 — Rôle Underdog (cap 2)

- Assignable uniquement par les équipes éligibles au sein de leur squad GT ou Race Team.
- **`underdog` est un rôle à part entière** (comme gc_leader, sprinter…) : un coureur a UN seul rôle, donc le boost underdog **remplace** le `role_mult` habituel — il ne s'y ajoute pas. Dans la formule §7, c'est la valeur que prend `role_mult` quand le rôle est underdog (pas un facteur séparé). Un underdog ne touche donc jamais aussi le ×1.5 gc_leader/sprinter.
- **Boost de scoring** : `role_mult = clamp(pcs_rank / 100, 1.0, 4.0)`.
  - Ex. : coureur rang 272 → ×2.72 ; rang 432 → ×4.0 (plafond) ; rang 69 → ×1.0 (plancher).
- **Pas de bonus sur les classements finaux** (GC, Points, KOM, Youth).
- Coureur éligible au rôle : `pcs_rank > 100`.
- **Exclusif avec Nemesis** : si un duel Nemesis affecte le coureur sur l'étape, le boost underdog ne s'applique pas (voir §13).

### Avantage 2 — Cap squad élargi (8 → 10)

- Pour les équipes éligibles : capacité du squad GT et Race Team portée de **8 à 10 coureurs**.
- Valide pour les Grands Tours **et** les courses d'une semaine (gating `race_slug`-aware dans le trigger `enforce_gt_squad_cap`).
- Borné par les slots de roster liés au niveau : L5+ pour utiliser les 10 emplacements (L5 = 10 slots).
- Revient automatiquement à 8 dès la première course suivant la sortie d'éligibilité.

### Avantage 3 — Remise salariale −50 % (réversible)

- **Condition contrat** : le coureur doit avoir `pcs_rank > 100` **et** l'équipe doit être éligible au moment du recrutement.
- Le flag `contracts.underdog_discount boolean` est posé à l'INSERT par le trigger `trg_flag_underdog_contract`.
- **Au payday** : si le flag est `true` **et** l'équipe est encore éligible (`underdog_eligible = true`), le salaire effectif = `floor(locked_salary × 0.5 / 1 000) × 1 000` (arrondi à **1 000 €**, per Spec D).
- **Réversible** : si l'équipe sort de l'éligibilité, le payday suivant facture le plein tarif (`locked_salary`). Le flag contrat reste `true` mais est ignoré tant que l'équipe n'est plus éligible.
- La remise est tracée dans `treasury_log` avec le suffixe `[underdog -50%]` dans la description.

---

## 15. Admin tools

### grant_xp (commissioner / admin)

- The commissioner can manually grant XP to a team via the `grant_xp` RPC (admin tool).
- Each adjustment is recorded in `team_xp_adjustments` with type, amount, and reason for full traceability.
- Used for compensating bugs, pre-season tournament rewards, or manual catch-up after PCS sync issues.

---

## 16. Late Join (Mid-Season)

A player can join an **active league** (one that has already started auctions).

| Rule | Value |
|------|-------|
| Starting XP | Average of existing teams' cumulative XP |
| Starting treasury | Average of existing teams' treasury (rounded to nearest 1,000) |
| Starting level | Computed from average XP (`compute_level`) |
| Sponsor | None — player must select one (locked until next phase if Round 1 closed) |
| Strategies | None — player configures after joining |

- The new team inherits the league's progression so they are competitive immediately.
- Treasury is rounded to the nearest 1,000 (because bids must be multiples of 1,000).
- No retroactive race results — XP starts accumulating from the join date.

---

## 17. GT Rescue (DNF Refund/Replace)

During Grand Tours, riders can abandon (DNF). The GT Rescue system gives players options when this happens.

### Trigger
- A rider in a player's GT squad is detected as DNF during stage scoring.
- The `dnf_stage` is recorded on the `gt_squad` entry.

### Options

| Option | Effect | Timing |
|--------|--------|--------|
| **Refund** | Claim 50% salary refund + contract auto-released (5-day cooldown) + earned GT XP forfeited | Anytime during the GT after DNF |
| **Replace** | Place an emergency bid on a new rider (same league) | Until end of **1st rest day** of the GT (Europe/Paris) |

### Replace window — why gated to the 1st rest day
- Without a gate, a player could DNF late in the GT and recruit a fresh
  rider for the upcoming WT phase at a discounted "emergency" price. Closing
  the replace window at the 1st rest day prevents this exploit while still
  giving a fair early-GT rescue path.
- The cutoff is materialized in `public.gt_rescue_windows`
  (`gt_identifier`, `gt_year`, `replace_closes_at`) and enforced server-side
  inside the `gt_place_emergency_bid` RPC. The UI mirrors the gate via
  `getReplaceWindowClosesAt()` in `apps/web/lib/gt-stage-schedule.ts`.
- Special case Giro 2026 : 3 rest days (11/18/25 May) due to the opening
  transfer. The 11 May rest day counts as rest day 1 — simplification, no
  exception baked into the rule.

### Emergency bids
- Same rules as regular bids: min = rider's market salary, multiples of 1,000, ≥ 5000 €.
- Budget validation: `treasury >= bid amount`.
- Only riders **not already in the league** can be emergency-bid.
- The emergency contract has `phase_recruited_id` set (same release lock as regular contracts).
- One active emergency bid per team per GT.

### Refund
- Refund amount: **50% of locked phase salary**, credited to treasury.
- All GT XP earned by the rider on that GT for the team is **forfeited** (negative `grant_xp` call).
- Contract is **released** with the standard 5-day cooldown (`available_from = now() + 5d`).
- Refund is available the **entire duration of the GT**, not just on rest days.

---

## 18. Sponsor GT Goals (V1b)

> Applies to **T4+ sponsors** (T4: Ineos, Decathlon AG2R, Soudal Quick-Step, Lidl-Trek; T5: Visma-Lease a Bike, Red Bull-Bora).

T4+ sponsors offer **one-time bonus goals** during Grand Tours, on top of regular race-result bonuses (§9).

### Structure
- Each goal-eligible sponsor defines a set of GT-specific goals (e.g., "Podium GC final", "Stage win"), per archetype (GC / Sprint / CLM / Stage-Hunter).
- Goals are **role-gated**: only riders with the matching GT role for that archetype (e.g. gc_leader, sprinter, tt_specialist, climber, stage_hunter) can trigger a goal.
- Goals follow a "best of two" tiered structure: if a higher-tier goal is completed, the lower-tier payout is replaced (not cumulated).
- Each goal pays **once per GT** — tracked in `sponsor_goal_completions`.

### Cumul rule: one-time goal vs base race bonus

**No cumul (Aligned in code).** When a rider triggers a one-time sponsor goal, the base race bonus (§9) for that same rider on the same race is **neutralized** — only the goal payout is credited, never both.

How it works: `evaluate_sponsor_goals` runs **before** `process_race_bonuses` and persists the consumed base-bonus race_slugs in `sponsor_goal_completions.neutralized_stage_slugs`. `process_race_bonuses` reads them and skips emitting those base bonuses. Because the base bonus is never created, reruns can never re-credit it (idempotent by construction).

Mapping goal → neutralized base bonus:
- `gc_podium` / `gc_top5` → the final GC result (`{parent}/gc`).
- `sprint_win_stage` / `sh_win_stage` → the won stage.
- `sprint_win_2_stages` / `sh_win_2_stages` → **every counted stage** (sprinter profile gating p1/p2/p3 respected — a non-flat stage win that doesn't count toward the goal keeps its base bonus).
- `sh_kom_classification` / `sprint_points_classification` and wear-jersey goals → no-op (no single-race base bonus exists for these).

Historical note: GC no-cumul was applied manually during the 2026-06-03 Giro cutover (3 base bonuses reverted); stage-win cumul was preserved for that one cutover and aligned in code before the Tour de France 2026.

### Evaluation
- Goals are evaluated after each stage scoring.
- Payout is credited to treasury immediately upon goal completion.

---

## 19. Game Modes — Manager vs Classic

WattHunter has **two league modes**, selected at league creation and stored in
`leagues.mode` (`'manager' | 'classic'`, default `'manager'`). Everything in §1–§13
above describes **Manager mode** (the original, full-economy game). **Classic mode** is a
simpler, more egalitarian variant that reuses the same auction + scoring engine but flattens
the economy. The two modes share exactly one persistent invariant: **cumulative XP + the
league GC ranking**.

### Manager vs Classic at a glance

| | Manager (default) | Classic |
|---|---|---|
| Economy | Persistent treasury, sponsor income, recurring salaries | Flat **2M budget reset every phase**, no salaries, no sponsors |
| Market | Progressive unlock by level + co-unlock | **Everyone is level 8** → full rider pool |
| Balancing | Level curve, co-unlock, underdog | None (equality via equal budget) |
| Squad | Roster ≤12 (contracts) + 8-rider GT squad + bench | **Single layer: 10 riders = the squad** |
| Tactics | 5 | 4 (**Call the Bus removed** — no bench) |
| Policies / strategies | Yes | No |
| Sponsors / GT goals | Yes | No |
| Underdog | Yes (catch-up for trailing teams) | Reused as 2 **Wildcard** slots per squad (`underdog_eligible` stays false) |
| Persists between phases | Roster + treasury | **Only cumulative XP + GC** |

### Classic rules (locked)

1. **4 phases** (a shorter calendar than Manager's 9): Classics (id 3) → Giro (4) → Tour (6)
   → Vuelta (8). See `lib/classic-phases.ts` (`CLASSIC_PHASE_IDS`).
2. **Flat 2M budget** (`CLASSIC_PHASE_BUDGET`), reset to 2M at the start of each phase.
   No treasury carries over, no recurring salary. A bid is a **one-time cost** inside the
   phase envelope (sum of bids ≤ treasury, enforced by `place_bid` as in Manager).
3. **All teams level 8** → full pool, co-unlock always satisfied, no level differentiation.
4. **10 riders per phase** (`CLASSIC_SQUAD_SIZE`), single layer: the GT squad **is** the
   roster. Role caps: 1 GC, 1 sprint, 1 climb, 1 TT, 2 stage hunters, 2 domestiques, **2
   Wildcards = 10**. `place_bid` caps the squad at 10 in classic (vs 12 at level 8 in Manager).
   **Wildcard** = the `underdog` role reused only for its scoring multiplier (stage points ×
   clamp(pcs_rank/100, 1, 4), no final-classification bonus); available in classic regardless
   of `underdog_eligible`. Migration `20260630130000` (reversible via `_rollback/*.down.sql`).
5. **3 auction rounds** per phase (unchanged).
6. **Roster frozen** during a phase: no release/rebid once the phase auction has started.
7. **No sponsors, no policies, no underdog.**
8. **Call the Bus removed** (no bench). The other 4 tactics remain.
9. Achievements, Level and Treasury columns are **left as-is** — Level/Treasury simply render
   empty in classic (no column removal = no custom code).

### Budget lifecycle (important nuance)

The per-phase reset is the `classic_phase_reset` RPC (migration `20260625000100`): it sets
`treasury = 1,500,000`, archives/releases the previous phase's contracts (new auction starts
on an empty squad, full budget), and marks the phase confirmed. It is the classic counterpart
of `confirm_phase_setup` and runs at the **phase transition** (when the last round of a phase
closes, via `triggerPhasePayday`).

Because that reset fires at phase **end**, the **first** phase's budget is **not** funded by
it — it is seeded at team creation via `classicTeamDefaults()` (`level 8`, `treasury 2M`,
`underdog_eligible false`, no sponsor). The phase-transition RPC is routed by
`phaseResetRpcFor(mode)`.

### What classic keeps / neutralizes / removes

| System | Classic | Mechanism |
|---|---|---|
| Auctions + 3 rounds, exclusive ownership | Keep | Unchanged (`contracts` unique constraint) |
| Scoring + cumulative XP + GC | Keep | `scoring.py` is **mode-agnostic** (never reads `mode`) |
| GT roles + caps (8), tactics (4) | Keep | `gt_squad` reused; Call the Bus removed |
| Level / pool gating / co-unlock | Neutralize | Everyone level 8 (config, not code) |
| Underdog | Neutralize | `underdog_eligible = false` |
| Sponsors + bonuses + GT goals | Remove | No sponsor assigned; `sponsor_bonus.py` / `goal_evaluator.py` not run on classic leagues |
| Policies / strategies | Remove | Not exposed; strategy boost = 0 |
| Persistent treasury / recurring salaries | Replace | 2M reset per phase |
| Bench / roster ≤12 / Call the Bus | Remove | Single 8-rider layer |

### One pipeline, not two

Classic is **not a parallel system**. Round resolution (`forceResolveRound`) and scoring
(`scoring.py`) are fully shared and never branch on mode. Classic adds only **three shallow
branch points**: the `place_bid` slot cap (8), the phase-reset RPC choice
(`classic_phase_reset` vs `confirm_phase_setup`), and budget display.

### Classic UI (mode-conditional rendering)

- **Nav / Team tab**: no Budget tab; the Team tab is the **Race Team** (GT squad builder)
  only — `/team` redirects to `/team/gt` in classic.
- **Auction**: Sponsor & Strategies section hidden; slot counter shows `/10`; budget shown as
  `treasury − spent` (consistent in the summary card and the sticky footer).
- **Tactics**: Call the Bus card hidden.
- **Lobby**: "Level & Pool" tab hidden (everyone level 8).
- **Ranking / Achievements**: unchanged.

### Status & caveats (as of 2026-06-30)

- Shipped via PR #52 (`056ade4`); front aligned to classic rules + Tour 2026 stage calendar
  added 2026-06-30 (slots, budget, sponsor hiding, team→GT redirect, home "next phase").
- **MVP covers the GT phases** (Giro/Tour/Vuelta). **Classics-phase scoring is deferred**
  (one-day races, raw PCS path, no roles/tactics).
- **Stage schedules**: Giro 2026 + Tour 2026 present in `lib/gt-stage-schedule.ts`; **Vuelta
  2026 still missing** (stage cards won't render during the Vuelta until added).
- Playtest league: see the "Classic League V2 seed" memory.
