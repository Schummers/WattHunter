# Documentation & Repository Cleanup — Implementation Plan

> **For agentic workers:** Execute each task in order. Read the target file, apply the fix, commit. No code changes — docs and repo hygiene only.

**Goal:** Fix all stale/outdated documentation, archive shipped specs/plans, clean MEMORY.md, and update CLAUDE.md / ARCHITECTURE.md / GAME_RULES.md to reflect the codebase as of 2026-05-08 (PRs #15–#26 all merged).

**Audit findings (2026-05-08):**
- 83 migrations (docs say 40+), 28 tables (docs say 15+)
- 18 SQL functions total: **12 SECURITY DEFINER user-callable RPCs** (docs say 5) + 4 trigger functions + 2 helpers
- 157 vitest tests / 17 files (docs say 17+ tests), 22+ pytest tests
- GT Tactics, GT Squad Builder V2, auto-resolve, force-resolve, payday fix, 7-day cooldown, late join, password reset, legal pages — all shipped but undocumented
- 15+ specs/plans for shipped features still in `docs/superpowers/` instead of archive
- 6 new routes added since 2026-04-24 (`forgot-password`, `reset-password`, `league/choose`, `(legal)/privacy`, `(legal)/terms`, `team/gt/tactics`)
- 13+ new components (GT Tactics suite, banners, modals, lock badges)
- 10+ new lib files (`tactics.ts`, `co-unlock.ts`, `gt-*.ts`, `remontada.ts`, `sponsors.ts`)
- CLAUDE.md still references `docs/TODO_BACKLOG.md` (file moved to `docs/archive/TODO_BACKLOG.md`)
- ARCHITECTURE.md schema diagram missing 7 tables (`gt_squad`, `gt_role_assignments`, `gt_daily_classifications`, `gt_tactic_activations`, `round_validations`, `team_xp_adjustments`, `team_ranking_daily`)
- 3 review docs in `docs/reviews/` from PR #13 — candidates for archive
- MEMORY.md at 209 lines (limit 200), multiple stale entries

**Pre-requisite (DONE):** Branch cleanup — 28 stale branches deleted (13 remote, 15 local), 16 orphan worktrees removed. Only `main`, `fix/ci-lockfile`, and active worktree remain.

---

## Task 1: Archive shipped specs & plans

Move shipped feature specs and plans from `docs/superpowers/` to `docs/archive/plans-completed/`. These features are all merged to main.

### 1a. Move shipped specs

```bash
mkdir -p docs/archive/specs-completed

# April 2026 — all shipped
mv docs/superpowers/specs/2026-04-02-market-mybids-design.md docs/archive/specs-completed/
mv docs/superpowers/specs/2026-04-02-phase-economy-and-release-design.md docs/archive/specs-completed/
mv docs/superpowers/specs/2026-04-02-sponsors-rework-design.md docs/archive/specs-completed/
mv docs/superpowers/specs/2026-04-03-budget-sponsor-redesign-design.md docs/archive/specs-completed/
mv docs/superpowers/specs/2026-04-03-budget-sponsor-redesign.md docs/archive/specs-completed/
mv docs/superpowers/specs/2026-04-04-round-countdown-unified-design.md docs/archive/specs-completed/
mv docs/superpowers/specs/2026-04-22-grand-tour-mode-v1a-design.md docs/archive/specs-completed/

# May 2026 — shipped
mv docs/superpowers/specs/2026-05-03-sponsor-gt-goals-design.md docs/archive/specs-completed/
mv docs/superpowers/specs/2026-05-08-auto-resolve-consensus-design.md docs/archive/specs-completed/
mv docs/superpowers/specs/2026-05-08-auto-resolve-consensus-minimal-design.md docs/archive/specs-completed/
mv docs/superpowers/specs/2026-05-08-payday-fix-and-release-messages-design.md docs/archive/specs-completed/
```

**Keep in place (not shipped or reference docs):**
- `2026-05-05-late-join-design.md` — not yet implemented
- `2026-05-06-budget-transactions-fix-design.md` — partial/ongoing
- `2026-05-06-sponsor-strategy-lock-and-round-lifecycle.md` — reference for round lifecycle logic
- `2026-05-08-database-backup-strategy-design.md` — not yet implemented

### 1b. Move shipped plans

```bash
# April 2026
mv docs/superpowers/plans/2026-04-02-market-mybids-implementation.md docs/archive/plans-completed/
mv docs/superpowers/plans/2026-04-02-phase-economy-implementation.md docs/archive/plans-completed/
mv docs/superpowers/plans/2026-04-02-sponsors-rework.md docs/archive/plans-completed/
mv docs/superpowers/plans/2026-04-03-budget-sponsor-redesign.md docs/archive/plans-completed/
mv docs/superpowers/plans/2026-04-04-round-countdown-unified.md docs/archive/plans-completed/
mv docs/superpowers/plans/2026-04-22-grand-tour-mode-v1a.md docs/archive/plans-completed/

# May 2026
mv docs/superpowers/plans/2026-05-03-sponsor-gt-goals.md docs/archive/plans-completed/
mv docs/superpowers/plans/2026-05-08-auto-resolve-consensus-implementation.md docs/archive/plans-completed/
mv docs/superpowers/plans/2026-05-08-manual-force-resolve-implementation.md docs/archive/plans-completed/
mv docs/superpowers/plans/2026-05-08-payday-fix-and-release-messages.md docs/archive/plans-completed/
```

**Keep in place:**
- `2026-05-05-late-join-plan.md` — not yet implemented
- `2026-05-06-budget-transactions-fix.md` — partial/ongoing
- `2026-05-06-sponsor-strategy-lock-and-round-lifecycle.md` — reference
- `2026-05-08-documentation-cleanup.md` — this file (active)

### 1c. Move old docs/plans/ shipped items

```bash
mv docs/plans/2026-04-23-anti-runaway-system-design.md docs/archive/plans-completed/
mv docs/plans/2026-04-23-co-unlock-rule-plan.md docs/archive/plans-completed/
mv docs/plans/2026-04-23-level-curve-stretch-plan.md docs/archive/plans-completed/
mv docs/plans/2026-04-23-remontada-boost-plan.md docs/archive/plans-completed/
mv docs/plans/2026-04-30-code-review-fixes-implementation.md docs/archive/plans-completed/
mv docs/plans/2026-05-08-gt-tactics-design.md docs/archive/plans-completed/
mv docs/plans/2026-05-08-gt-tactics-implementation.md docs/archive/plans-completed/
```

**Keep in place:**
- `docs/plans/2026-04-02-game-simplification-backlog.md` — living backlog
- `docs/plans/2026-04-03-market-auctions-redesign-plan.md` — reference
- `docs/plans/2026-04-03-market-auctions-redesign-spec.md` — reference
- `docs/plans/2026-04-04-review-fixes.md` — reference
- `docs/plans/2026-04-20-grand-tour-mode-backlog.md` — living backlog

- [ ] Commit: `chore: archive 28 shipped specs and plans to docs/archive/`

---

## Task 2: Fix CLAUDE.md

**File:** `CLAUDE.md` (project root)

### 2a. SECURITY DEFINER RPCs section

Replace:
```
### SECURITY DEFINER RPCs (mutations critiques)
Les 5 mutations économiques passent par des RPCs atomiques (`SECURITY DEFINER`) dans Postgres.
```

With:
```
### SECURITY DEFINER RPCs (mutations critiques)
12 RPCs user-callable + 4 trigger functions + 2 helpers (compute_level, is_league_member, set_updated_at, handle_new_user). Les 12 RPCs critiques :
```

Update the list to:
```
- `place_bid` — enchère avec 11 validations (budget cross-round, level gating, slots, co-unlock, 7-day cooldown)
- `validate_round` — conversion draft_bids → auction_bids + auto-resolve si consensus
- `release_rider` — libération coureur avec phase lock (effet à la phase suivante)
- `confirm_phase_setup` — payday : sponsor income + salaires + bankruptcy cascade + activation sponsor/strategies pending
- `leave_league` — quitter ligue avec cascade cleanup
- `join_league_by_code` — rejoindre ligue avec code invite + init XP (late-join supporté)
- `grant_xp` — ajustement XP admin avec traçabilité (table team_xp_adjustments)
- `gt_add_to_squad` — ajout coureur au squad GT (cap 8)
- `gt_assign_role` — assignation rôle GT (append-only, cutoff 11:00 CET)
- `gt_remove_from_squad` — retrait coureur du squad GT (soft-delete)
- `gt_swap_slot` — swap coureurs dans le squad GT
- `place_tactic` — placement tactique GT avec validation (usage limit, stage lock)

Et 1 RPC interne (appelée par scoring.py, pas user-callable) :
- `resolve_nemesis_for_stage` — résolution PvP duel Nemesis lors du scoring d'une étape
```

### 2b. Architecture tree

Add these missing routes:

Under `(auth)/`:
```
│   │   ├── (auth)/
│   │   │   ├── forgot-password/      # Reset password request
│   │   │   ├── reset-password/       # Reset password form
│   │   │   └── league/choose/        # League picker if user has multiple
```

New top-level group:
```
│   │   ├── (legal)/
│   │   │   ├── privacy/              # Privacy policy
│   │   │   └── terms/                # Terms of service
```

Under `(game)/league/[leagueId]/`:
```
│   │   │       ├── auction/
│   │   │       │   ├── status/         # Round status table + force-resolve button
│   │   │       │   └── rounds/         # Round validation (commissioner)
│   │   │       ├── team/
│   │   │       │   └── gt/             # Grand Tour squad builder
│   │   │       │       └── tactics/    # 5 in-race tactics placement
```

### 2c. Supabase lib section

Replace:
```
│   └── lib/supabase/            # Clients Supabase (browser + server)
```

With:
```
│   └── lib/supabase/
│       ├── browser.ts           # Client côté navigateur (anon key)
│       ├── server.ts            # Client côté serveur (cookies)
│       ├── admin.ts             # Client service-role (server-only, RPCs admin)
│       └── middleware.ts        # Refresh session + protection routes
```

### 2d. Server Actions section

Replace the existing list with the full set (13 action files):
```
- `app/(auth)/league/create/actions.ts` — create league
- `app/(auth)/league/join/actions.ts` — join league via code (→ join_league_by_code RPC)
- `app/(game)/league/[leagueId]/actions.ts` — league-level actions (force-resolve, etc.)
- `app/(game)/league/[leagueId]/auction/[auctionId]/actions.ts` — placeBid, cancelBid, draft bids
- `app/(game)/league/[leagueId]/auction/actions.ts` — validateRound, addDraft, removeDraft
- `app/(game)/league/[leagueId]/auction/market/actions.ts` — confirmPhaseSetup (→ payday)
- `app/(game)/league/[leagueId]/auction/rounds/actions.ts` — round dates management
- `app/(game)/league/[leagueId]/budget/actions.ts` — budget operations
- `app/(game)/league/[leagueId]/rider/[riderId]/actions.ts` — releaseRider
- `app/(game)/league/[leagueId]/settings/actions.ts` — updateTeamName, leaveLeague, updateLeagueName
- `app/(game)/league/[leagueId]/team/gt/actions.ts` — GT squad management
- `app/(game)/league/[leagueId]/team/gt/tactics/actions.ts` — place_tactic, get rivals
- `app/(game)/league/[leagueId]/team/strategies/actions.ts` — strategy management
```

### 2e. Migrations description

Replace `15+ tables SQL` with `83 migrations SQL (28 tables)`.

### 2f. Seed description

In "État du scaffold", replace `5 politiques + 10 sponsors en base` with `4 strategy types + 13 sponsors (6 tiers)`.

### 2g. Remove stale convention

Remove the line `- NEVER hardcoder CONVERSION_RATE (env var)` from "Conventions importantes" (env var deleted with sponsors rework April 2026).

### 2h. Add release cooldown rule

Add to "Règles critiques (NEVER DO)":
```
- NEVER autoriser une enchère sur un coureur releasé depuis moins de 7 jours (cooldown anti-exploit).
```

- [ ] Commit: `docs: update CLAUDE.md — 12 RPCs, GT routes, admin client, accurate counts`

---

## Task 3: Fix ARCHITECTURE.md

**File:** `docs/ARCHITECTURE.md`

### 3a. Update header date

Change `Derniere mise a jour : 2026-04-24` to `Derniere mise a jour : 2026-05-08`.

### 3b. Stack table

Change `40+ migrations, RLS enforced` to `83 migrations, RLS enforced`.

### 3c. Route tree

Add under `(game)/league/[leagueId]/`:
```
│   │   │       ├── auction/
│   │   │       │   ├── status/         # Round status + resolve/auto-resolve
│   │   │       │   └── rounds/         # Round validation (commissioner)
│   │   │       ├── team/
│   │   │       │   └── gt/             # GT Squad builder + tactics
```

### 3d. Components list

Add all 13 new components shipped post-2026-04-24:
```
│   │   ├── tactic-card.tsx              # GT tactic card (5 types)
│   │   ├── tactic-modal-shell.tsx       # Shared modal shell for tactic placement
│   │   ├── tactic-boost-modal.tsx       # Unleash/Overdrive/Call the Bus placement
│   │   ├── tactic-nemesis-modal.tsx     # 2-step Nemesis modal (rival → stage)
│   │   ├── tactic-stage-list.tsx        # Stage picker for tactic placement
│   │   ├── team-tactics-section.tsx     # Tactics orchestrator on GT Team page
│   │   ├── nemesis-incoming-banner.tsx  # PvP duel notification banner
│   │   ├── home-gt-banner.tsx           # GT phase banner on home
│   │   ├── remontada-boost-banner.tsx   # Anti-runaway boost banner
│   │   ├── release-confirm-modal.tsx    # Contextual release modal (auction + rider detail)
│   │   ├── rider-lock-badge.tsx         # Co-Unlock Rule lock indicator
│   │   ├── rider-picker-sheet.tsx       # Rider picker (GT squad, nemesis target)
│   │   ├── gt-goals-preview.tsx         # Sponsor GT goals display
```

### 3e. Lib files

Replace the existing `lib/` block with the full current state:
```
│   └── lib/
│       ├── supabase/
│       │   ├── browser.ts            # Anon browser client
│       │   ├── server.ts             # Anon server client (cookies)
│       │   ├── admin.ts              # Service-role client (server-only)
│       │   ├── middleware.ts         # Session refresh + route protection
│       │   ├── get-user.ts           # Cached user lookup
│       │   ├── get-open-auction.ts   # Cached auction state lookup
│       │   └── database.types.ts     # Generated Supabase types
│       ├── boost.ts                  # Strategy bonus calculation
│       ├── budget.ts                 # Budget P&L computation
│       ├── calendar.ts               # WT calendar helpers
│       ├── co-unlock.ts              # Co-Unlock Rule eligibility checks
│       ├── format.ts                 # countryCodeToFlag, formatEuro, smartCountdown
│       ├── gt-goals.ts               # Sponsor GT goals helpers
│       ├── gt-phases.ts              # GT phase detection
│       ├── gt-stages.ts              # GT stage list per phase
│       ├── levels.ts                 # 8-level system (XP, slots, pool, sponsor)
│       ├── phases.ts                 # WT phase helpers
│       ├── photo-url.ts              # Rider photo URL resolution
│       ├── remontada.ts              # Remontada Boost helpers
│       ├── rider-detail-data.ts     # Unified rider detail fetcher
│       ├── sponsors.ts               # Sponsor data + bonus calculation
│       ├── strategies.ts             # 4 strategy types + matching logic
│       ├── tactics.ts                # 5 GT tactics catalog + helpers
│       └── env.ts                    # Env var validation (Zod)
```

### 3f. Migrations table

Change heading from `### Migrations appliquees (40+)` to `### Migrations appliquees (83)`.

Add to migration list:
```
| `20260503*` | Code review fixes: SECURITY DEFINER RPCs, triggers, round constraint 1-8 |
| `20260505*` | Late join, sponsor GT goals, budget transactions |
| `20260506*` | Sponsor base bonuses rework, strategy lock |
| `20260507*` | 7-day release cooldown, round_validations, gt_tactic_activations |
| `20260508*` | GT Tactics RPCs (place_tactic), scoring traceability columns |
```

Change seed description from `5 strategies + 10 sponsors` to `4 strategy types + 13 sponsors (6 tiers)`.

### 3g. DB Schema diagram

Replace the schema diagram with the current 28-table state:
```
users ←──── league_members ────→ leagues
  │                │                  │
  └── teams ───────┘                  │
       │                              │
       ├── contracts → riders         │
       ├── team_strategies → strategies
       ├── team_sponsors → sponsors
       ├── treasury_log
       ├── rider_xp_daily              (with role_mult, gt_classif_bonus, remontada_mult)
       ├── team_xp_adjustments         (admin grant_xp audit trail)
       └── team_ranking_daily          (daily snapshots for overtake detection)

       auctions → auction_bids
              → draft_bids
              → round_validations      (validation marker + force-resolve audit)

       riders → race_results
              → rider_season_rankings
              → rider_teams
              → rider_pcs_history
              → race_startlists

       sponsor_bonuses                 (per-result bonus payments)

       Anti-Runaway:
       remontada_boost_triggers        (1 trigger max per ordered pair A→B per GT)
       remontada_boosts                (active boost: stages remaining, ×2 mult)

       Grand Tour Mode:
       gt_squad                        (8-cap roster per phase)
       gt_role_assignments             (append-only role history, 11:00 CET cutoff)
       gt_daily_classifications        (per-stage GC/sprint/KOM cache)
       gt_tactic_activations           (5 tactics, 1 use per GT each)
```

### 3h. Tests section

Replace:
```
| vitest | `apps/web/.../actions.test.ts` | 17+ | server actions, auction bids |
```

With:
```
| vitest | `apps/web/**/*.test.ts` | 157 (17 files) | server actions, auction bids, GT tactics, round lifecycle |
```

### 3i. Etat d'avancement — add shipped features

Add to "Implemente":
```
- [x] Force-resolve round (status table + any-player resolve button)
- [x] Auto-resolve on consensus (all players validate → round auto-resolves)
- [x] Payday in confirm_phase_setup (sponsor income + salary deduction)
- [x] 7-day release cooldown (prevents timing exploit on auctions)
- [x] GT Tactics (5 tactical abilities: Unleash, Overdrive, Nemesis GC/Sprint, Call the Bus)
- [x] GT Squad builder V2 (cap 8, flexible changes during phase)
- [x] Purchasing power display on status page
- [x] Contextual release modal (auction + rider detail)
- [x] grant_xp RPC (admin XP adjustments with traceability)
- [x] Rider detail unified across all entry points
```

### 3j. Add ADR for GT Tactics

```
### ADR-015 : GT Tactics — 5 tactiques in-race
- **Decision :** 5 tactiques GT (Unleash, Overdrive, Nemesis GC, Nemesis Sprint, Call the Bus)
- **Raison :** Profondeur stratégique pendant les Grands Tours, différenciation des joueurs

### ADR-016 : Auto-resolve consensus
- **Decision :** Round auto-resolve quand tous les joueurs ont validé
- **Raison :** Supprime le besoin d'intervention commissioner, accélère le flow

### ADR-017 : 7-day release cooldown
- **Decision :** Coureur releasé ne peut pas être re-enchéri pendant 7 jours
- **Raison :** Prévient l'exploit buy-check_salary-release-rebid
```

- [ ] Commit: `docs: update ARCHITECTURE.md — 83 migrations, 28 tables, 12 RPCs, GT Tactics, post-May features`

---

## Task 4: Fix GAME_RULES.md

**File:** `docs/GAME_RULES.md`

### 4a. Update date

Change `Last updated: 2026-04-24` to `Last updated: 2026-05-08`.

### 4b. Add 7-day release cooldown to §6 Contracts

Add after "Releasing a rider" section:
```
**7-day cooldown:**
- After release, the rider **cannot be bid on by anyone** for 7 calendar days
- Prevents the exploit: bid → check salary → release → rebid at minimum
- The rider appears in the market with a "Available from [date]" indicator
```

### 4c. Add round resolution rules to §5 Auctions

Add new subsection:
```
**Round validation & resolution:**
- Each player must **validate their round** (confirm their bids) before the round closes
- When **all league members have validated**, the round **auto-resolves** (consensus trigger)
- Any league member can manually trigger "Resolve Round" from the Status tab as fallback
- Resolution applies the sealed-bid auction algorithm (§5 Resolution)
- `round_validations` table tracks who validated when + force-resolve audit trail
```

### 4d. Add §13 Grand Tour Tactics (new section)

```
## 13. Grand Tour Tactics

> Implemented: 2026-05-08 (PR #25)
> Spec: `docs/archive/plans-completed/2026-05-08-gt-tactics-design.md`

5 tactical abilities available during Grand Tours (Giro, Tour de France, Vuelta). Each tactic modifies scoring for specific riders on specific stages.

### Available Tactics

| Tactic | Effect | Target | Limit |
|--------|--------|--------|-------|
| **Unleash** | ×1.5 XP for domestiques | All non-GC riders on roster | 1 per GT |
| **Overdrive** | ×2.0 XP for stage hunters | 1 specific rider | 1 per GT |
| **Nemesis GC** | PvP duel on GC classification | 1 rival team's GC rider | 1 per GT |
| **Nemesis Sprint** | PvP duel on sprint classification | 1 rival team's sprinter | 1 per GT |
| **Call the Bus** | Bench riders contribute XP | All bench riders | 1 per GT |

### Placement rules
- Tactics are placed **before a stage starts** (11:00 CET cutoff)
- Each tactic can be used **once per Grand Tour**
- Nemesis tactics require selecting a rival team and a specific rider
- Effects apply for the **duration of the selected stage** only

### Scoring integration
- Tactic modifiers are applied **after** strategy bonuses, **before** Remontada Boost
- Traceability: `rider_xp_daily` records `role_mult` and `gt_classif_bonus` per scoring event
```

### 4e. Update §11 Game Constants

Add to the table:
```
| Release cooldown | 7 days after release |
| Round resolution | Auto on consensus, or manual force-resolve |
| GT Tactics per GT | 1 of each type (5 total) |
```

### 4f. Add payday detail to §10

Update the "Payday" subsection step 3:
```
3. Calculation: `treasury += sponsor_budget − sum(active_salaries)`
   - Sponsor income credited
   - All active rider salaries deducted
   - If treasury < −10,000 → bankruptcy cascade (§4.5)
```

- [ ] Commit: `docs: update GAME_RULES.md — GT Tactics, 7-day cooldown, auto-resolve, payday`

---

## Task 5: Fix MEMORY.md + memory files

**File:** `~/.claude/projects/-Users-jonathanschummers-Documents-WattHunter/memory/MEMORY.md`

### 5a. Fix stale counts

- "Tests automatisés" section: change `123 tests (12 fichiers)` → `157 tests (17 fichiers)`, date → `2026-05-08`
- "Infra locale" section: change `34 migrations appliquées from scratch` → `83 migrations`
- "Pipeline PCS — état validé" section: change `500 riders synchronisés (top 500 PCS global)` → `600 riders synchronisés (top 600 PCS global)`

### 5b. Fix stale items

- "Décision produit" section: change `email_notify.py à supprimer` → `email_notify.py supprimé (fait)`
- "Conventions importantes" section: remove `NEVER hardcoder CONVERSION_RATE (env var)` line

### 5c. Fix stale paths

- "Phase 2 — PCS Pipeline" section: update doc paths to `docs/archive/plans-completed/2026-02-27-*`

### 5d. Condense to stay under 200 lines

Remove or merge these sections that are now redundant with ARCHITECTURE.md:
- "État du scaffold (complété 21/02/2026)" — 7 lines, information is in ARCHITECTURE.md "Etat d'avancement"
- "Décisions techniques Phase 2" — 3 lines, covered by Pipeline PCS section
- "Redesign complet (implémenté 2026-03-06)" — 3 lines, old news
- "Team Level + Wireframe Audit (2026-03-08)" — 3 lines, old news
- "Pipeline E — État enrichissement riders (2026-04-04)" — 5 lines, one-time fix done
- "Gotchas DB" — merge the 4 bullet points into a shorter "DB gotchas" 2-liner

### 5e. Add GT Tactics to MEMORY.md

Add entry:
```
- [GT Tactics](gt_tactics.md) — 5 in-race tactics shipped 2026-05-08 (PR #25). Unleash, Overdrive, Nemesis GC/Sprint, Call the Bus.
```

### 5f. Update memory files

**`sponsors_rework.md`:**
- Change description `needs impl plan` → `implemented (flat base bonuses, GT sponsor goals)`
- Change body to note "Implemented. Spec archived to `docs/archive/specs-completed/`."

**`grand_tour_mode.md`:**
- Update: V1a implemented (GT Squad Builder V2 + GT Tactics). Route: `/team/gt/`
- V1b: parked (user-curated sponsor GT goals)

**`anti_runaway_system.md`:**
- Change "manual smoke tests pending" → "Shipped to main 2026-04-24. Giro 2026 started 2026-05-08."

### 5g. Create `gt_tactics.md` memory file

```markdown
---
name: GT Tactics
description: 5 in-race tactical abilities for Grand Tours — Unleash, Overdrive, Nemesis GC/Sprint, Call the Bus
type: project
---

GT Tactics shipped 2026-05-08 (PR #25).

5 tactics: Unleash (×1.5 domestiques), Overdrive (×2.0 stage hunter), Nemesis GC (PvP duel), Nemesis Sprint (PvP duel), Call the Bus (bench riders contribute).

**Why:** Adds strategic depth during Grand Tours, differentiates player decisions beyond roster building.

**How to apply:** Tables: `gt_tactic_activations`. RPC: `place_tactic` (SECURITY DEFINER). Scoring: `role_mult` + `gt_classif_bonus` columns in `rider_xp_daily`. Spec archived at `docs/archive/specs-completed/`.
```

- [ ] Commit: `docs: update MEMORY.md + memory files — accurate counts, GT Tactics, condense under 200 lines`

---

## Task 6: Update spec statuses

For each spec file that remains in `docs/superpowers/specs/` (not archived), verify its status is accurate:

| Spec | Current Status | Correct Status |
|------|----------------|----------------|
| `2026-05-05-late-join-design.md` | Approved | `Approved — not yet implemented` |
| `2026-05-06-budget-transactions-fix-design.md` | (none) | `Partial — ongoing` |
| `2026-05-06-sponsor-strategy-lock-and-round-lifecycle.md` | Approved | `Approved — reference doc (round lifecycle implemented)` |
| `2026-05-08-database-backup-strategy-design.md` | (none) | `Draft — not yet implemented` |

- [ ] Commit: `docs: update remaining spec statuses`

---

## Task 7: Clean up docs/plans/ backlog files

### 7a. Verify living backlogs are current

Read and check these files still make sense:
- `docs/plans/2026-04-02-game-simplification-backlog.md` — any items now done?
- `docs/plans/2026-04-20-grand-tour-mode-backlog.md` — V1a done, update status

### 7b. Fix TODO_BACKLOG.md path references

**Confirmed:** the file is at `docs/archive/TODO_BACKLOG.md` but CLAUDE.md still points to `docs/TODO_BACKLOG.md` in 2 places (lines 228, 240) and ARCHITECTURE.md (line 134).

Update all 3 references:
- `CLAUDE.md` line 228: `docs/TODO_BACKLOG.md` → `docs/archive/TODO_BACKLOG.md`
- `CLAUDE.md` line 240: `docs/TODO_BACKLOG.md` → `docs/archive/TODO_BACKLOG.md`
- `docs/ARCHITECTURE.md` line 134: `TODO_BACKLOG.md` → `archive/TODO_BACKLOG.md`

### 7c. Mention `docs/known-issues-pcs.md` in ARCHITECTURE.md

This file documents known PCS sync bugs (e.g., parser fallback bad data on Romain Grégoire). Add to the "docs/" tree in ARCHITECTURE.md:
```
│   ├── known-issues-pcs.md      # Bugs PCS sync sans fix automatisé
```

- [ ] Commit: `docs: update backlogs and fix stale paths`

---

## Task 8: Archive old code review docs

**Files in `docs/reviews/`** — these were used to drive PR #13 and are now reference history:
- `2026-04-04-full-review.md`
- `2026-04-30-12-problems-detailed.md`
- `2026-04-30-code-review-senior.md`

```bash
mkdir -p docs/archive/reviews-completed
mv docs/reviews/2026-04-04-full-review.md docs/archive/reviews-completed/
mv docs/reviews/2026-04-30-12-problems-detailed.md docs/archive/reviews-completed/
mv docs/reviews/2026-04-30-code-review-senior.md docs/archive/reviews-completed/
rmdir docs/reviews
```

Update MEMORY.md "Code Review Fixes" section: change paths from `docs/reviews/` to `docs/archive/reviews-completed/`.

- [ ] Commit: `docs: archive code review docs from PR #13`

---

## Task 9: Clean fix/ci-lockfile branch

**Branch:** `fix/ci-lockfile` — 1 commit: `fix(ci): update pnpm-lock.yaml with test dependencies`

This branch is checked out in the main repo worktree. Decision needed:
- If the lockfile update is already on main → delete branch, checkout main
- If not on main → merge or cherry-pick, then delete

### Action:
```bash
# Check if main already has the lockfile changes
git diff main..fix/ci-lockfile -- pnpm-lock.yaml | head -5

# If different: merge to main
# If same: just checkout main and delete the branch
```

- [ ] Resolve fix/ci-lockfile branch status
- [ ] Ensure main repo worktree is on `main` branch

---

## Execution Summary

| Task | Files | Commits |
|------|-------|---------|
| 1. Archive specs/plans | 28 files moved | 1 |
| 2. Fix CLAUDE.md | 1 file | 1 |
| 3. Fix ARCHITECTURE.md | 1 file | 1 |
| 4. Fix GAME_RULES.md | 1 file | 1 |
| 5. Fix MEMORY.md + memory files | 5 files | 1 |
| 6. Update spec statuses | 4 files | 1 |
| 7. Clean backlogs | 3 files (CLAUDE.md, ARCHITECTURE.md path fix) | 1 |
| 8. Archive review docs | 3 files moved | 1 |
| 9. Clean ci-lockfile branch | git ops | 0-1 |
| **Total** | ~50 files | 8-9 commits |

**Estimated execution time:** 30-45 min (all doc changes, no code).
