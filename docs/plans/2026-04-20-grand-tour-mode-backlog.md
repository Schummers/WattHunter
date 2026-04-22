# Grand Tour Mode — Backlog

**Date:** 2026-04-20 (last updated same day)
**Status:** V1a LOCKED · V1b direction LOCKED · V1c+ captured
**Target event:** Giro d'Italia 2026 (2026-05-08 → 2026-05-31)

---

## Executive Summary

The Grand Tour Mode adds a **tactical layer** for Grand Tours only, on top of the existing season-long systems (roster, strategies, sponsor). It is delivered in **two phases**:

| Phase | Content | Target |
|---|---|---|
| **V1a** | Squad of up to 8 + 5 specialist roles + daily classification scoring + new `GT Team` sub-tab (read-only sponsor goals preview) + nav reshuffle | Ships before Giro 2026-05-08 |
| **V1b** | Sponsor base-bonus tweak + 4-5 fixed GT goals per sponsor with completion tracking and cash rewards | Ships during/after Giro, in time for Tour 2026-07-04 |
| **V1c+** | Substitutes, level gating, jersey tracking niceties, stage profile distinction, consumable powers, nemesis | Future, unscoped |

The two phases are **fully independent**: V1a gives the tactical feel via roles; V1b layers sponsor pressure. Players can enjoy Giro on V1a alone.

## Navigation Restructuring (part of V1a)

The bottom nav (mobile) and sidebar (desktop) get one new tab and one sub-tab:

**New top-level order**: `Home · Auction · Team · Budget · Ranking` (was: Home · Team · Budget · Ranking).

- **Home** — unchanged. A banner CTA points to GT Team when a GT is active (V1a scope).
- **Auction** (NEW) — absorbs the current `/auctions` (calendar) and `/team/auctions` (participation) and the current Market sub-tab. Sub-tabs TBD during implementation, candidate split: `Market · Auctions · History`.
- **Team** — sub-tabs reshuffled:
  - `My Team` (default) — roster + a level card at the top + a strategies access card. No more `Strategies` sub-tab; access stays via a card/link, same as today's rail equivalent.
  - `GT Team` (NEW) — visualisation-only sponsor card on top (read-only: base bonuses, goals with completion checkbox in V1b). Squad management (8 slots + role assignment) below. Disabled/empty state outside active GT windows.
- **Budget** — unchanged for V1a. V1b may add a link to current GT goal status (TBD in V1b design).
- **Ranking** — unchanged.

### GT Team Tab States

Driven by the existing **auction phase calendar** (`AUCTION_PHASES` in `apps/web/lib/phases.ts`). Each Grand Tour is tied to one phase (Giro phase, Tour phase, Vuelta phase).

- **Inactive** (no GT phase currently active): tab shows a locked/empty state with "Next Grand Tour: [name] — starts in X days". Countdown uses next GT phase start date.
- **Active** (GT phase currently running, from phase start to phase end): full interactive UI. Squad auto-filled at phase start with top-N PCS riders as Domestique. Player can edit roles anytime. Cutoff: 11:00 CET to apply role changes to the day's stage; after 11:00, changes apply from next stage.
- **Transition** (phase ends → next phase begins): tab resets. Squad cleared, roles cleared. Back to Inactive until next GT phase.

No historical drill-down kept here (ranking page covers league-wide history; Home feed will cover daily stage details in a future iteration).

### Home Banner (V1a scope)
During an active GT phase, the Home page displays a persistent banner:
> 🏁 **Giro in progress — manage your squad** →

Click → navigate to `/team/gt` (or equivalent route under Team tab).

Banner text uses the current GT's name. Hidden when no GT phase is active.

### Auction Tab Structure (V1a scope)
New top-level `Auction` tab absorbs 3 existing concerns. Sub-tabs in order:

1. **Auctions** (default) — current `/team/auctions` content: your bids, round validation, upcoming rounds with edit dates.
2. **Market** — current `/team/market` content: browse riders, recruits flow.
3. **History** — current auction history (currently buried behind a button in market/auction pages).

Side effects:
- Top-right "History" button on current Market and Auctions pages is **removed** (content migrates to the `History` sub-tab).
- The commissioner's "Edit round date" button takes the now-freed top-right slot on the `Auctions` sub-tab, aligned with the "Rounds" section heading.
- No dedicated calendar sub-tab needed — upcoming rounds already surface the next 3 phase dates inside the Auctions sub-tab.

### Known Bug to Fix (V1a scope)
On the current `/team/auctions/rounds` page, round cards touch the left and right edges of the screen (no padding). Cards should respect the page horizontal borders and adjust dynamically. Fix during V1a implementation (cheap touch-up since we're rewiring the parent tab).

---

## V1a — Squad + Roles + Scoring (LOCKED)

### Squad
- **Up to 8 riders** picked from the team roster. Squad size = `min(8, roster_size)`.
- Level 1 teams (roster 6) field a squad of 6. Level 2 (roster 7) → 7. Level 3+ → 8. No level gating on GT Mode itself.
- **No substitutes in V1a**. (Deferred to V1c+.)
- Only squad riders score during the GT. Non-selected roster riders follow normal flow if they are racing parallel events (unlikely during the Giro window — see §Concurrent Races below).

### Roles
Five named roles + domestiques, exactly **8 slots total**:

| Slot count | Role | PCS-points multiplier (applied to that rider's results during GT) | Daily classification bonus |
|---|---|---|---|
| 1 | **GC Leader** | ×1.5 on all PCS points | Top 10 GC daily (10→1 pts) × 1.5 |
| 1 | **Sprinter** | ×1.5 on all PCS points | Top 5 points-classif daily (5→1 pts) × 1.5 |
| 1 | **Climber** | ×1.5 on all PCS points | Top 3 KOM-classif daily (3→1 pts) × 1.5 |
| 1 | **TT Specialist** | ×2 on PCS points from ITT stages **only** | — |
| 2 | **Stage Hunter** | ×1.5 on PCS points from stage results **only** (not final classifications) | — |
| 2 | **Domestique** | ×1 (no bonus) | — |

Total = **up to 8 slots** (all riders, any role). Max specialist slots: 1 Leader + 1 Sprinter + 1 Climber + 1 TT + 2 Stage Hunters = 6. Min = 0 (all domestiques). Unassigned = domestique by default.

**Daily classification bonus** = extra XP awarded to every squad rider who finishes in the top N of a daily classification after a stage:
- GC → top 10: 10/9/8/7/6/5/4/3/2/1 points.
- Points classification → top 5: 5/4/3/2/1 points.
- KOM classification → top 3: 3/2/1 points.
- Any squad rider who enters the top N earns the base points. **Only the role-holder** (GC Leader / Sprinter / Climber) gets the ×1.5 multiplier on those points.

### Role Assignment Rules
- Squad contains up to 8 distinct riders from the roster.
- **Auto-fill:** when a GT starts, the squad is silently pre-filled with the roster's top riders by PCS points, all tagged **Domestique** by default. The player is free to assign specialist roles anytime after.
- **Specialist roles are optional.** A player can leave the squad as all-domestiques and still participate (scoring at base ×1).
- **Max per specialist role** is enforced:
  - GC Leader: max 1
  - Sprinter: max 1
  - Climber: max 1
  - TT Specialist: max 1
  - Stage Hunter: max 2
  - Domestique: no cap (fills the remainder)
- Assigning a role to a rider automatically unassigns the previously-assigned rider (if any) back to Domestique. Swapping riders within a role is atomic.
- Consequence: a conservative player carries all-domestiques (safe, ×1 everywhere); an aggressive player fills all 6 specialist slots; most will be somewhere in between.
- Roles can be edited **any time during the GT**. Cutoff: **11:00 CET** to apply to that day's stage; after 11:00, changes apply from the next stage.
- **Role-based attribution** (not stage-profile-based):
  - Your sprinter wins a mountain stage → counts like any stage win for him (×1.5 via his "all PCS" multiplier).
  - Your stage hunter wins a flat sprint → counts for stage hunter (×1.5 on stage PCS).
  - **Exception:** TT Specialist's ×2 applies **only on ITT stages** — ITT stages must be explicitly tagged in the pipeline.

### Data Pipeline Extensions
- **New table: `gt_daily_classifications`**
  - Stores per-stage-per-rider position in each of the 3 classifications.
  - Schema (draft): `(race_slug, stage, rider_id, classification_type, rank)` with PK `(race_slug, stage, rider_id, classification_type)`.
- **Pipeline B (post-race) extension**: after importing a GT stage result, additionally scrape `Stage.gc()`, `Stage.points()`, `Stage.kom()` from PCS and upsert into `gt_daily_classifications`.
- **ITT stage flag**: `race_results.is_itt` boolean or `stage_type` enum, populated at import time from PCS stage profile.

### Scoring Flow (per GT, per day)
```
for each squad rider R:
  for each race_result of R during GT (stages + final classifications):
    pts = result.pcs_points
    if R.role = GC Leader  OR Sprinter OR Climber: pts *= 1.5
    elif R.role = TT Specialist and result is ITT stage: pts *= 2
    elif R.role = Stage Hunter and result is a stage (not final classif): pts *= 1.5
    # else domestique → *= 1
    xp += pts

  for each stage S during GT:
    # GC classification bonus
    rank_gc = gt_daily_classifications[R, S, 'gc']
    if rank_gc <= 10:
      bonus = (11 - rank_gc)
      if R.role = GC Leader: bonus *= 1.5
      xp += bonus
    # Points classification bonus (top 5)
    rank_pts = gt_daily_classifications[R, S, 'points']
    if rank_pts <= 5:
      bonus = (6 - rank_pts)
      if R.role = Sprinter: bonus *= 1.5
      xp += bonus
    # KOM classification bonus (top 3)
    rank_kom = gt_daily_classifications[R, S, 'kom']
    if rank_kom <= 3:
      bonus = (4 - rank_kom)
      if R.role = Climber: bonus *= 1.5
      xp += bonus
```

### Concurrent Races
During the Giro 2026 window (May 8–31), no other WT race runs in parallel. Stage races resume with Dauphiné (Jun 7). So for V1a we don't need to handle "rider in squad AND in a parallel race".

### Clarifications Pending Before Spec
_All scoring, squad, and navigation rules resolved. Remaining micro-questions listed in the brainstorming chat — once answered, we move to writing the V1a spec._

---

## V1b — Sponsor Base-Bonus Rework + 6-Goal GT Objectives (DIRECTION LOCKED)

Design and implementation deferred — here is the direction agreed in brainstorming.

### T3 sponsors — Revised base bonuses

GC-oriented (Groupama, Movistar):
| Line | Threshold | Amount |
|---|---|---|
| GC | Top 15 | +30K |
| Stage | Top 5 | +10K |
| One-day race | Top 15 | +5K |
| Monument | Top 15 | +10K |

One-day-oriented (Alpecin, Uno-X):
| Line | Threshold | Amount |
|---|---|---|
| GC | Top 15 | +10K |
| Stage | Top 5 | +5K |
| One-day race | Top 15 | +10K |
| Monument | Top 15 | +20K |

Nationality multiplier ×1.5 stays as-is. `if_grand_tour ×2` multiplier **removed** (replaced by the 6-goal GT objectives below). `if_monument ×2` multiplier **removed** (replaced by the explicit Monument line).

### T4 sponsors — Unified base bonuses (all T4 sponsors same amounts)
| Line | Threshold | Amount |
|---|---|---|
| GC | Top 10 | +40K |
| Stage | Podium (top 3) | +10K |
| One-day race | Top 10 | +10K |
| Monument | Top 10 | +20K |

Differentiation between T4 sponsors comes purely from the **6-goal GT objectives** and the nationality multiplier. Orientations listed below only matter for the objectives mix.

### T5 / T6 sponsors — Untouched in V1b
Current model kept as-is. Users can't unlock them early enough to matter for the Giro.

### GT Objectives — 4-5 Fixed Goals Per Sponsor

- Available **only for Grand Tours** (Giro / Tour / Vuelta). Monuments are not covered in V1b.
- Each sponsor has **4-5 fixed goals** — no picking by the player.
- Each goal is independent: success pays its own reward; failure = 0.
- Rewards = cash (primary) + possibly XP (TBD in V1b design).
- Goals are **hand-defined per sponsor** (no auto-generator). The user will curate them from the idea list below.
- Goals visible in read-only mode inside `GT Team` tab (V1a preview) and get the completion-checkbox overlay once V1b ships.

### Sponsor Specialty Map (for goals mix)

| Sponsor | Tier | Nat | GT orientation |
|---|---|---|---|
| Groupama | T3 | FR | GC |
| Movistar | T3 | ES | GC |
| Alpecin | T3 | BE/NL | One-day (→ Sprint + Stage Hunter) |
| Uno-X | T3 | DK/NO | One-day (→ Sprint + Stage Hunter) |
| Ineos | T4 | GB | GC + TT |
| Decathlon | T4 | FR | GC + Sprint |
| Soudal | T4 | BE | One-day (→ Sprint + Stage Hunter) |
| Lidl-Trek | T4 | US/IT | One-day (→ Sprint + Stage Hunter) |

Pool of goal ideas to pick from — see **[Goal Idea Bank](#v1b-goal-idea-bank)** below.

---

## V1c+ — Deferred Backlog

Each item is captured so we don't lose the idea. None are scoped.

### Substitutes (8+2 with rest-day swaps)
- 8 starters + 2 substitutes on the bench.
- Can swap any starter with a substitute **only on rest days** (Giro has 2).
- Adds bench management strategy.
- Deferred because 8-only is shippable today and the swap UX is a rabbit hole.

### Level Gating (resolved)
- V1a ships with no gating: squad size = `min(8, roster_size)`. Captured here only for history.

### Stage Profile Distinction (sprint / hilly / mountain / ITT)
- Attach PCS stage profiles to results (flat/hilly/mountain/ITT/TTT).
- Enables sponsor goals like "win a flat stage" or "podium on a mountain stage".
- Enables more nuanced role bonuses (e.g. stage hunter ×2 on hilly only).
- Deferred because V1a uses role-based attribution; profile data only becomes necessary for goal specificity in V1b+.

### Consumable Powers (3 per GT)
- Tactical single-use boosts (e.g. "all domestiques chase breakaway today → ×2 XP on stage points").
- 3 uses per GT.
- Deferred because V1a without consumables is already novel. Add once base is proven.

### Nemesis System
- Each squad rider picks a rival from another team's squad.
- Bonus when your rider beats the rival on a stage or in final GC.
- Creates inter-team narrative.
- Deferred because cross-team coordination is complex and speculative.

### Probability Data Integration
- Scrape pre-GT odds (PCS / bookmakers) to calibrate goal difficulty and nemesis matching.
- Deferred because V1b goals are hand-curated by the user, so calibration is manual for now.

### T5 / T6 Sponsor Rework
- Same treatment as T3/T4 in V1b (flat base bonuses + goals overlay).
- Deferred because few players reach Level 7–8; not priority until usage justifies it.

### Jersey-Wearing Time Tracking
- Track which squad rider held the pink / cyclamino / azzurra jersey on which days.
- Needed for V1b goals like "wear maglia rosa ≥ 5 days".
- Partially covered by the V1a `gt_daily_classifications` table (the rank=1 of each classif per day = jersey holder). Explicit view/materialization in V1b.

---

## V1b Goal Idea Bank

Long list of goal ideas. The user will hand-curate 6 per sponsor. Grouped by family for picking convenience. Each goal suggested with an indicative difficulty tier (E=easy, M=medium, H=hard) and a placeholder reward range.

### A. GC (classement général)
1. **Win the Giro** (a squad rider finishes #1 GC) — H — 200K+ — T6-only
2. **Podium GC** (top 3) — H — 100K
3. **Top 5 GC** — M — 50K
4. **Top 10 GC** — E — 20K
5. **Top 20 GC** — E — 10K
6. **Two squad riders in top 20 GC** — M — 40K
7. **A [nationality] squad rider in top 15 GC** — M — 30K
8. **Finish the GT with zero abandons from the squad** — H — 40K

### B. Stages (generic)
9. **Win 1 stage** — E — 25K
10. **Win 2 stages** — M — 60K
11. **Win 3 stages** — H — 120K
12. **Win 2 stages with the same rider** — M — 60K
13. **Win a stage from two different squad riders** — M — 50K
14. **Top 3 on 3 different stages** — M — 40K
15. **Top 5 on 5 different stages** — M — 50K
16. **A [nationality] squad rider wins a stage** — M — 40K
17. **A [nationality] squad rider top 3 on a stage** — E — 20K

### C. Jerseys (worn for ≥ N days)
18. **Wear the pink jersey (GC leader) ≥ 1 day** — M — 40K
19. **Wear the pink jersey ≥ 5 days** — H — 80K
20. **Wear the cyclamino (points) ≥ 3 days** — M — 30K
21. **Wear the cyclamino ≥ 7 days** — H — 60K
22. **Wear the azzurra (KOM) ≥ 3 days** — M — 30K
23. **Wear the azzurra ≥ 7 days** — H — 60K
24. **Hold any jersey (pink/points/KOM) for ≥ 1 day** — E — 20K
25. **Hold 2 different jerseys during the GT (non-concurrent)** — H — 70K

### D. Final Classifications (non-GC)
26. **Win the points classification** — H — 80K
27. **Top 3 points classification** — M — 40K
28. **Win the KOM classification** — H — 80K
29. **Top 3 KOM classification** — M — 40K
30. **Win the young-rider classification (if tracked)** — M — 50K — ⚠ needs white jersey scraping

### E. ITT (Time Trial)
31. **Win an ITT** — H — 80K
32. **Podium on an ITT** — M — 40K
33. **Top 5 on every ITT of the GT** — H — 60K
34. **A [nationality] squad rider top 5 on an ITT** — M — 35K

### F. Consistency / Team Depth
35. **Three different squad riders earn PCS points on three different stages** — M — 40K
36. **Every squad rider earns at least 1 PCS point during the GT** — H — 60K
37. **Squad earns N+ total PCS points (calibrated to sponsor tier)** — M-H — 50K-100K
38. **Three riders top 10 on the same stage** — H — 80K
39. **Two riders top 5 on the final GC** — H — 100K

### G. Combo / Narrative
40. **Win a stage AND wear a jersey for ≥ 1 day with the same rider** — H — 70K
41. **Podium GC without ever wearing the pink jersey before the final stage** — H — 80K — ⚠ hard to verify automatically
42. **Win 2 stages in the last week of the GT** — M-H — 60K — ⚠ needs stage-week logic

---

## Notes for V1b Design (when we get to it)

- Goal rewards are placeholders — calibrate against typical phase income.
- Some goals need extra data (white jersey, stage-week bucket). Flag ⚠ items for deferral if the plumbing is heavy.
- Consider whether a **failed goal** pays 0 flat or inflicts a small penalty. Current thinking: 0 flat (no penalty) keeps it a simple upside bet.
- Consider adding **XP reward** to each goal (currently just cash). Probably small XP (e.g. +20 XP for easy, +100 for hard) so the goals matter for leveling.
- Consider whether objectives can be **re-picked** if the squad is catastrophically injured mid-GT. Probably no in V1b (commit at round 3, fixed).
