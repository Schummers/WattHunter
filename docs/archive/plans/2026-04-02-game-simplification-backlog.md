# Game Simplification — Backlog

**Date:** 2026-04-02
**Status:** Topics identified during brainstorming, to be designed in future sessions
**Related:** `docs/superpowers/specs/2026-04-02-sponsors-rework-design.md` (sponsors — DONE)

---

## Validated Topics (design complete, ready for implementation planning)

### 1. Sponsors Rework
- **Spec:** `docs/superpowers/specs/2026-04-02-sponsors-rework-design.md`
- **Summary:** 6 tiers, 13 sponsors, 1 sponsor per team, no eligibility conditions, bonus from race results, daily finance
- **Status:** Design validated, needs implementation plan

---

## Topics To Design (each needs its own brainstorming session)

### 2. Release Rider Simplification
- **Current:** Release only during auction window, notice period until next phase, 1 month salary cost
- **Target:** Release anytime, 2K flat fee, immediate effect, rider returns to pool immediately
- **Impact:** Remove `notice` status, remove `effective_phase_id` from contracts, simplify `releaseRider()` action
- **Dependencies:** None (independent of sponsors)

### 3. Policy Rework
- **Current:** 5 policy types, max active slots by level, changes pending outside auction window, sponsor-policy entanglement
- **Target:** Immediate change + 15-day cooldown per policy, fully decoupled from sponsors
- **Open questions:**
  - Cooldown per policy or global?
  - Keep all 5 policy types or simplify?
  - Do age policies (Young Blood / Road Warriors) stay automatic or become configurable?
  - With sponsors decoupled, does the Specialty policy still make sense? (It only boosted XP, not sponsor eligibility)
- **Dependencies:** Sponsors rework (decoupling must be done first)

### 4. Daily Finance System
- **Current:** Monthly cycle (1st of month): sponsor payment → salary deduction → bankruptcy check
- **Target:** Daily cycle: sponsor base/30 per day, salary/30 per day, bonuses on race day
- **Open questions:**
  - Daily pipeline trigger: cron job vs on-demand vs part of post-race pipeline?
  - How to handle days with no pipeline run (weekends, off-season)?
  - Treasury display: show daily rate or monthly equivalent?
  - Rounding: daily amounts will have decimals (250K/30 = 8333.33€)
- **Impact:** Replace `monthly_finance.py` with `daily_finance.py` or integrate into scoring pipeline
- **Dependencies:** Sponsors rework (new bonus model)

### 5. Bankruptcy Adaptation
- **Current:** 2 consecutive months negative → auto-release best scorers first
- **Target:** Adapt to daily finance — when does bankruptcy trigger?
- **Open questions:**
  - Trigger: negative treasury for N consecutive days? Below a threshold?
  - Grace period before auto-release?
  - Keep "best scorers released first" or switch to "highest salary first"?
- **Dependencies:** Daily finance system

### 6. Auction Phase Decoupling
- **Current:** 7 phases aligned with WT calendar, auctions at end of each phase, everything tied to phases (releases, sponsor changes, policy changes)
- **Target:** With release/sponsors/policies now independent of phases, auctions become the ONLY thing tied to phases
- **Open questions:**
  - Do we keep the 7-phase structure for auctions?
  - Or switch to more frequent, shorter auction windows?
  - How does the WT calendar alignment work with the new 8-level system?
- **Dependencies:** Release + Policy + Sponsor reworks

### 7. Phase Transition Cleanup
- **Current:** `applyPhaseTransition()` handles: notice→released contracts, pending→active sponsors, pending→active policies
- **Target:** With all mechanics becoming immediate, phase transitions may be unnecessary
- **Open questions:**
  - Is there anything left that needs phase transitions?
  - Can we remove the entire pending/effective system?
- **Dependencies:** All above reworks

### 8. Scoring Pipeline Refactor
- **Current:** `scoring.py` calculates XP + rider bonus (`max(0, pts × 1500 - salary)`)
- **Target:** Remove rider bonus calculation, add sponsor bonus calculation
- **Open questions:**
  - Keep XP calculation in same pipeline or separate?
  - How to classify races (One-Day vs Monument vs GC vs GT) reliably?
  - Need a `race_classifications` table or extend existing slug mapping?
- **Dependencies:** Sponsors rework + Daily finance

### 9. Pipeline Consolidation
- **Current:** 6 separate pipelines (init-riders, post-race, enrich-riders, daily-scoring, auction-resolution, monthly-finance)
- **Target:** Review which pipelines are still needed and if any can be merged
- **Open questions:**
  - Can daily-scoring + sponsor-bonus be merged into post-race?
  - Can monthly-finance be replaced entirely by daily-finance inside scoring?
  - Does auction-resolution need changes?
- **Dependencies:** All pipeline-touching reworks

### 10. Level/XP Unlock Coherence
- **Current:** 8 levels with sponsor unlocks at L1, L3, L5, L7, L8
- **Target:** Verify sponsor unlocks match new 6-tier system (T1=L1, T2=L2, T3=L3, T4=L5, T5=L7, T6=L8)
- **Note:** Level 4 and Level 6 don't unlock any sponsor tier — is this intentional?
- **Dependencies:** Sponsors rework

---

## Clarified / Closed Items (no design needed)

### Starting Treasury
- Stays at 200K (current value)
- Lotto (250K/mois) auto-assigned at team creation → player is immediately funded
- No change needed

### Salary Formula
- **UNCHANGED**: `max(5000, floor(pcs_points × 2000 / 12 / 100) × 100)`
- No discussion or rework planned

### XP Calculation
- **UNCHANGED**: `xp = pcs_points × (1 + Σ policy_bonuses)`
- Only the financial bonus system changes (old rider bonus deleted, replaced by sponsor bonuses)
- XP is a separate mechanic from finances

---

## Priority Order (suggested)

1. **Sponsors rework** (done — needs implementation plan)
2. **Release rider** (simple, independent)
3. **Daily finance** (foundation for new economy)
4. **Scoring pipeline refactor** (depends on sponsors + daily finance)
5. **Policy rework** (depends on sponsor decoupling)
6. **Bankruptcy adaptation** (depends on daily finance)
7. **Auction phase decoupling** (depends on everything above)
8. **Phase transition cleanup** (last — remove dead code)
9. **Pipeline consolidation** (optimization pass)
10. **Level/XP coherence check** (verification pass)
