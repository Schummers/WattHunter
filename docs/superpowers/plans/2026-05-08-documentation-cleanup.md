# Documentation Cleanup — Implementation Plan

> **For agentic workers:** Execute each task in order. Read the target file, apply the fix, commit. No code changes — docs only.

**Goal:** Fix all stale/outdated documentation identified during the 2026-05-08 audit. MEMORY.md, CLAUDE.md, GAME_RULES.md, and ARCHITECTURE.md have drifted from the codebase since the May 2026 sprint (PRs #15-#19).

**Context:** An audit cross-checked code vs docs and found ~20 inconsistencies. This plan fixes them all. No code changes — purely documentation.

---

## Task 1: Fix MEMORY.md stale entries

**File:** `/Users/jonathanschummers/.claude/projects/-Users-jonathanschummers-Documents-WattHunter/memory/MEMORY.md`

### Fixes to apply:

- [ ] **1a.** Section "Tests automatisés (mis à jour 2026-05-03)" — change `123 tests (12 fichiers)` to `145 tests (15 fichiers)` and update date to `2026-05-08`.

- [ ] **1b.** Section "Infra locale" — change `34 migrations appliquées from scratch` to `75+ migrations`. Verify actual count with `ls supabase/migrations/*.sql | wc -l`.

- [ ] **1c.** Section "Pipeline PCS — état validé" — change `500 riders synchronisés (top 500 PCS global)` to `600 riders synchronisés (top 600 PCS global)` (pool increased with level rework April 2026).

- [ ] **1d.** Section "Décision produit : pas d'emails" — remove `email_notify.py à supprimer` line. The file has already been deleted. Replace with `email_notify.py supprimé (fait)`.

- [ ] **1e.** Section "Phase 2 — PCS Pipeline" — the doc paths point to `docs/plans/2026-02-27-*` but those files moved to `docs/archive/plans-completed/`. Update all 4 paths:
  - `docs/plans/2026-02-27-pcs-pipeline-and-auctions-implementation.md` → `docs/archive/plans-completed/2026-02-27-pcs-pipeline-and-auctions-implementation.md`
  - `docs/plans/2026-02-27-pcs-pipeline-and-auctions-design.md` → `docs/archive/plans-completed/2026-02-27-pcs-pipeline-and-auctions-design.md`
  - `docs/plans/2026-02-27-phase2-continuation.md` → `docs/archive/plans-completed/2026-02-27-phase2-continuation.md`
  - `docs/research/2026-02-27-pcs-data-access.md` stays (not moved)

- [ ] **1f.** Section "Conventions importantes" — remove `NEVER hardcoder CONVERSION_RATE (env var)` line. This env var was deleted with the sponsors rework (April 2026). The old rider bonus formula (`max(0, pts × 1500 - salary)`) no longer exists.

- [ ] **1g.** Commit: `docs: update MEMORY.md — fix stale counts, paths, and deleted items`

---

## Task 2: Fix memory files (individual)

### 2a. `sponsors_rework.md`

**File:** `/Users/jonathanschummers/.claude/projects/-Users-jonathanschummers-Documents-WattHunter/memory/sponsors_rework.md`

- [ ] Change description from `needs impl plan` to `implemented (flat base bonuses migration 20260506000000, GT sponsor goals migration 20260503)`.
- [ ] Change "Next step: write implementation plan" to "Implemented. Spec remains reference for future changes."

### 2b. `grand_tour_mode.md`

**File:** `/Users/jonathanschummers/.claude/projects/-Users-jonathanschummers-Documents-WattHunter/memory/grand_tour_mode.md`

- [ ] Update status: V1a is implemented (GT Squad Builder V2, migration `20260510000000_gt_squad_builder_v2.sql`, route `/team/gt/`).
- [ ] Change "Next step: writing-plans skill" to "V1a implemented. V1b blocker: user must curate sponsor GT goals."

### 2c. `anti_runaway_system.md`

**File:** `/Users/jonathanschummers/.claude/projects/-Users-jonathanschummers-Documents-WattHunter/memory/anti_runaway_system.md`

- [ ] Status says "manual smoke tests pending". The Giro started 2026-05-08. Either confirm smoke tests done or note they were skipped for launch. Ask the user if unsure.

- [ ] Commit: `docs: update memory files — sponsors rework, GT mode, anti-runaway status`

---

## Task 3: Fix CLAUDE.md stale sections

**File:** `/Users/jonathanschummers/Documents/WattHunter/CLAUDE.md`

### Fixes to apply:

- [ ] **3a.** Section "Conventions importantes" — remove the line `- NEVER hardcoder CONVERSION_RATE (env var)` (env var deleted).

- [ ] **3b.** Section "Architecture" tree — add these missing routes:
  ```
  │   │   │       ├── auction/
  │   │   │       │   ├── status/         # Round status + resolve button
  │   │   │       │   └── rounds/         # Round validation
  │   │   │       ├── team/
  │   │   │       │   └── gt/             # Grand Tour squad builder
  ```

- [ ] **3c.** Section "SECURITY DEFINER RPCs" — add `grant_xp` to the list (6 RPCs total, not 5). Update the line to:
  ```
  - `place_bid`, `validate_round`, `release_rider`, `confirm_phase_setup`, `leave_league`, `grant_xp`
  ```

- [ ] **3d.** Section "Architecture" mentions `15+ tables SQL` in the supabase/migrations description. Change to `75+ migrations SQL`.

- [ ] **3e.** Section about seed data says `5 politiques + 10 sponsors en base`. Update to `4 strategy types + 13 sponsors (6 tiers)`.

- [ ] **3f.** Section "Server Actions" — add the new actions files:
  ```
  - `app/(game)/league/[leagueId]/auction/rounds/actions.ts` — round management
  - `app/(game)/league/[leagueId]/budget/actions.ts` — budget operations
  - `app/(game)/league/[leagueId]/team/gt/actions.ts` — GT squad management
  ```

- [ ] **3g.** Add `admin.ts` to architecture:
  ```
  │   ├── lib/supabase/
  │   │   ├── server.ts           # Anon server client
  │   │   ├── client.ts           # Browser client
  │   │   └── admin.ts            # Service-role client (server-only)
  ```

- [ ] Commit: `docs: update CLAUDE.md — fix stale architecture, RPCs, conventions`

---

## Task 4: Update GAME_RULES.md

**File:** `/Users/jonathanschummers/Documents/WattHunter/docs/GAME_RULES.md`

- [ ] **4a.** Update `Last updated` to `2026-05-08`.

- [ ] **4b.** Add section or update existing auction section to mention:
  - Round validation creates a `round_validations` marker
  - When all league members validate, the round auto-resolves (consensus trigger)
  - Manual "Resolve Round" button available on Status tab as fallback
  - Any league member can trigger resolve (not just commissioner)

- [ ] **4c.** Add mention of `grant_xp` RPC for admin XP adjustments (if there's an admin/commissioner section).

- [ ] Commit: `docs: update GAME_RULES.md — add force-resolve, auto-resolve, grant_xp`

---

## Task 5: Update ARCHITECTURE.md

**File:** `/Users/jonathanschummers/Documents/WattHunter/docs/ARCHITECTURE.md`

- [ ] **5a.** Update `Last updated` to `2026-05-08`.

- [ ] **5b.** Add to the route tree:
  - `/auction/status/` — Round status + resolve button
  - `/team/gt/` — Grand Tour squad builder

- [ ] **5c.** Add to the components list:
  - `status-client.tsx` — Resolve round modal + button

- [ ] **5d.** Add `admin.ts` to `lib/supabase/` in the structure.

- [ ] **5e.** Add `round_validations` table mention in the DB section.

- [ ] **5f.** Update migration count if mentioned.

- [ ] Commit: `docs: update ARCHITECTURE.md — add status page, GT route, admin client, round_validations`

---

## Task 6: Update auto-resolve spec status

**File:** `/Users/jonathanschummers/Documents/WattHunter/docs/superpowers/specs/2026-05-08-auto-resolve-consensus-design.md`

- [ ] **6a.** Change `Status: Draft` to `Status: Phase 1 Shipped (PR #15), Phase 2 Shipped (auto-resolve consensus)`

- [ ] Commit: `docs: mark auto-resolve spec as shipped`
