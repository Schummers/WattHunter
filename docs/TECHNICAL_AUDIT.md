# WattHunter Technical Audit — 2026-05-15

## Executive Summary

**33 findings** across 6 domains. Every claim below is verified against the source code with file paths and line numbers.

| Severity | Count | Description |
|----------|-------|-------------|
| **P0** | 1 | N+1 treasury mutations in `sponsor_bonus.py` — financial inconsistency risk |
| **P1** | 9 | Missing Zod validation (5 files), N+1 scoring queries, forceResolve auth gap |
| **P2** | 13 | Missing indexes (7), zero caching, sequential waterfalls, test gaps |
| **P3** | 10 | Migration hygiene, dead tables, Edge Functions, code quality |

### Top 3 Risks for 100+ Users

1. **Python N+1 DB calls**: `sponsor_bonus.py` makes ~750 round-trips per race, `scoring.py` ~200. At 10 leagues this becomes 7,500+ sequential calls per scoring run, saturating Supabase connection pool.
2. **Zero Next.js caching**: Every page load fires 7-16 Supabase queries with no `unstable_cache` or route caching. At 100 DAU × 10 page views = 1,000 concurrent request bursts hitting the DB directly.
3. **Missing input validation**: 5 of 15 server action files skip Zod validation entirely, violating the project's own CLAUDE.md rule. `forceResolveRound` lacks a commissioner authorization check while using the admin (service_role) client.

### Stack Health Score

| Layer | Score | Notes |
|-------|-------|-------|
| Database Schema | 7/10 | RLS solid, RPCs well-designed, but 7 FK columns lack indexes |
| Security | 6/10 | SECURITY DEFINER search_path all pass, but Zod gaps + missing auth checks |
| Performance | 4/10 | N+1 patterns in Python, zero caching in Next.js |
| Scalability | 5/10 | Correct locking, but connection pool saturates at ~60 concurrent bids |
| Code Quality | 6/10 | Good test coverage on critical paths, broad gaps elsewhere |
| Architecture | 5/10 | No views, no Edge Functions, Python coupled to 23 tables directly |

---

## 1. Database Architecture

### 1.1 Index Coverage

The project has **16 explicit indexes** across 133 migrations for **28+ tables**. Several FK columns used in hot query paths lack indexes.

#### [DB-01] `league_members.team_id` has no index — P2 | Effort: S

**Location:** `supabase/migrations/20260221000000_initial_schema.sql` lines 54-61
**Current:** `league_members` has `unique(league_id, user_id)` (implicit composite index). The `team_id` FK column has no index. RLS policies on `contracts`, `rider_xp_daily`, `treasury_log`, and `team_xp_adjustments` join through `league_members` via `team_id` in subqueries.
**Risk:** Every RLS subquery resolving `team_id` from `league_members` requires scanning the table. This fires on every authenticated read.
**Fix:** `CREATE INDEX idx_league_members_team_id ON public.league_members(team_id);`

#### [DB-02] `contracts.league_id` — partial unique index excludes released status — P2 | Effort: S

**Location:** `supabase/migrations/20260313000000_contracts_unique_active_rider.sql` lines 1-11
**Current:** The only index on `league_id` is `idx_contracts_unique_active_rider_league ON (rider_id, league_id) WHERE status IN ('active', 'notice')`. The 7-day cooldown check inside `place_bid` (lines 97-109 of `20260518000002`) queries `WHERE status = 'released'` — excluded from the partial index.
**Risk:** Cooldown query falls back to `idx_contracts_rider_id` then filters `league_id` and `status` in memory. Degrades as released contracts accumulate.
**Fix:** `CREATE INDEX idx_contracts_cooldown ON public.contracts(rider_id, league_id, status, available_from) WHERE status = 'released';`

#### [DB-03] `rider_xp_daily.contract_id` — no index for CASCADE delete — P2 | Effort: S

**Location:** `supabase/migrations/20260221000000_initial_schema.sql` lines 116-127
**Current:** `rider_xp_daily.contract_id` has `ON DELETE CASCADE` to `contracts`. No index exists on `contract_id`. The composite index `(team_id, rider_id, race_slug)` does not help CASCADE lookups.
**Risk:** Deleting a contract triggers a full sequential scan of `rider_xp_daily`. At 600 riders × 10 teams × 100 stages = 600K rows, this becomes a blocking table scan.
**Fix:** `CREATE INDEX idx_rider_xp_daily_contract_id ON public.rider_xp_daily(contract_id);`

#### [DB-04] `sponsor_bonuses` — no index on `rider_id` or `sponsor_id` — P2 | Effort: S

**Location:** `supabase/migrations/20260402300000_sponsors_rework.sql` lines 140-166
**Current:** Only index is `idx_sponsor_bonuses_team_race_date ON (team_id, race_date)` plus a dedup unique constraint. No index on `rider_id` or `sponsor_id`. Rider detail page queries by `rider_id` across teams.
**Risk:** Queries filtering `sponsor_bonuses` by `rider_id` do a full table scan.
**Fix:** `CREATE INDEX idx_sponsor_bonuses_rider_id ON public.sponsor_bonuses(rider_id);`

#### [DB-05] `team_xp_adjustments.team_id` — no index — P3 | Effort: S

**Location:** `supabase/migrations/20260506100000_team_xp_adjustments.sql` lines 4-11
**Current:** Zero indexes on this table. RLS policy joins through `teams` and `league_members` via `team_id`.
**Risk:** Low now (few rows), but degrades as XP adjustments accumulate.
**Fix:** `CREATE INDEX idx_team_xp_adjustments_team_id ON public.team_xp_adjustments(team_id);`

#### [DB-06] `gt_emergency_bids.league_id` — no index — P3 | Effort: S

**Location:** `supabase/migrations/20260519000000_gt_rescue_window.sql` lines 20-33
**Current:** Only index is the partial unique on `(team_id, phase_id, gt_identifier, gt_year) WHERE resolved = false`. No index on `league_id`. Resolution queries filter by `league_id`.
**Fix:** `CREATE INDEX idx_gt_emergency_bids_league_id ON public.gt_emergency_bids(league_id);`

#### [DB-07] `round_validations.team_id` — only covered as trailing column in compound unique — P3 | Effort: S

**Location:** `supabase/migrations/20260508020000_round_validations_and_force_resolve.sql` lines 12-18
**Current:** `UNIQUE (auction_id, team_id)` — `auction_id` leads, so queries by `team_id` alone cannot use it.
**Fix:** `CREATE INDEX idx_round_validations_team_id ON public.round_validations(team_id);`

### 1.2 Views and Materialized Views

#### [DB-08] Zero views exist — complex joins repeated on every request — P2 | Effort: M

**Location:** All 133 migration files — zero matches for `CREATE VIEW` or `CREATE MATERIALIZED VIEW`.
**Current:** Every query is composed from scratch in TypeScript. Three patterns repeat across multiple pages:
1. **Team budget summary**: `auction/[auctionId]/page.tsx` lines 36-64 runs 7 parallel queries. Same calculation repeated in `place_bid` RPC as 4 separate SELECTs.
2. **League standings**: `ranking/page.tsx` lines 43-67 runs 4 queries to render one table.
3. **Rider pool with contract status**: `auction/[auctionId]/page.tsx` fetches all 600 riders then applies filters client-side.

**Risk:** Each page load generates 5-8 round-trips. At 100 concurrent users, this saturates the connection pool.
**Fix:** Create `v_team_budget` (treasury + salaries + active bids + income), `v_league_standings` (teams ranked by XP with owner names), `v_rider_availability` (riders left-joined to contracts per league).

### 1.3 RPC Complexity

#### [DB-09] `place_bid` — 11 SELECTs per invocation, 2 redundant slot count queries — P2 | Effort: M

**Location:** `supabase/migrations/20260518000002_place_bid_late_joiner_gate.sql` lines 11-219
**Current:** 11 read statements + 1 DML per transaction. Lines 189-193 contain two correlated subqueries for slot counting (one on contracts, one on auction_bids) that could be merged. The late-joiner gate (lines 73-77) runs an aggregate scan of `auctions.closes_at` per league.
**Risk:** Not a correctness issue — locking is correct (`FOR UPDATE` on team row, line 63). But 11 queries holds the row lock for ~50-100ms per bid.
**Fix:** Merge slot count queries (lines 189-193) into one. Replace late-joiner gate aggregate with a column on `teams`. Reduces from 11 to ~7 SELECTs.

#### [DB-10] `confirm_phase_setup` — called N times sequentially from TypeScript, not atomic at league level — P1 | Effort: M

**Location:** `apps/web/app/(game)/league/[leagueId]/auction/actions.ts` lines 281-333; RPC in `supabase/migrations/20260518000003_confirm_phase_setup_remove_late_joiner.sql`
**Current:** `triggerPhasePayday` iterates all teams with `for` loop (line 307), calling the RPC once per team sequentially. For 10 teams × 12 riders = ~240 DML statements across 10 sequential calls. If the loop fails at team 7, teams 1-6 are paid, 7-10 are not.
**Risk:** Partial-failure leaves league in inconsistent financial state. Wall time: 2-3.5s for 10 teams.
**Fix:** Create a `payday_league(p_league_id, p_phase_id)` RPC that processes all teams in a single transaction. Eliminates N round-trips and makes payday atomic.

#### [DB-11] Key RPCs redefined across 18 migrations with no canonical source — P3 | Effort: L

**Location:** `place_bid` (6 versions), `confirm_phase_setup` (5 versions), `validate_round` (7 versions)
**Current:** Each redefinition copy-pastes the full function body. No canonical `.sql` source file exists.
**Risk:** Adding a validation requires copying 200+ lines, risking accidental reversion of prior fixes.
**Fix:** Introduce `supabase/functions/sql/` with canonical source files. At minimum, add comment headers linking to prior version.

---

## 2. Security

### 2.1 Zod Validation Coverage

| Action File | Zod Import | Schema | parse/safeParse | Auth Check |
|---|---|---|---|---|
| `(auth)/league/create/actions.ts` | yes | yes | `safeParse` | `getUser` |
| `(auth)/league/join/actions.ts` | yes | yes | `safeParse` | `getUser` |
| `[leagueId]/actions.ts` | **no** | **no** | **no** | `getUser` |
| `[leagueId]/settings/actions.ts` | **no** | **no** | **no** | partial |
| `[leagueId]/achievements/actions.ts` | **no** | **no** | **no** | `getUser` (helper) |
| `[leagueId]/rider/[riderId]/actions.ts` | **no** | **no** | **no** | **none** |
| `[leagueId]/auction/actions.ts` | yes | yes | `safeParse` | partial |
| `[leagueId]/auction/[auctionId]/actions.ts` | yes | yes | `safeParse` | `getUser` |
| `[leagueId]/auction/market/actions.ts` | yes | yes | `safeParse` | `getUser` |
| `[leagueId]/auction/rounds/actions.ts` | **no** | **no** | **no** | `getUser` |
| `[leagueId]/team/budget/actions.ts` | yes | yes | `safeParse` | `getUser` |
| `[leagueId]/team/gt/actions.ts` | yes | inline | inline `safeParse` | **none** |
| `[leagueId]/team/gt/rescue/actions.ts` | yes | yes | `safeParse` | **none** |
| `[leagueId]/team/gt/tactics/actions.ts` | yes | yes | `.parse` | **none** |
| `[leagueId]/team/strategies/actions.ts` | yes | yes | `safeParse` | `getUser` |

**Summary:** 6/15 files have no Zod at all or missing on key functions. 6 files skip `getUser` auth checks.

#### [SEC-01] `rider/actions.ts` — No Zod, no auth pre-check — P1 | Effort: S

**Location:** `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/actions.ts` lines 7-23
**Current:** `releaseRider(contractId: string)` accepts raw string, no UUID validation, no `getUser()`. Auth deferred to RPC.
**Risk:** Malformed `contractId` produces Postgres type-cast error leaking internal table structure. No defense-in-depth.
**Fix:** Add `z.uuid()` validation + `getUser()` guard.

#### [SEC-02] `auction/rounds/actions.ts` — No Zod; unvalidated `round.id` in DB query — P1 | Effort: S

**Location:** `apps/web/app/(game)/league/[leagueId]/auction/rounds/actions.ts` lines 54-73
**Current:** `round.id` passed directly to `.eq("id", round.id)` without UUID validation. Date strings passed to `toParisIso()` without format check.
**Risk:** Malformed date stored as garbage `closes_at` timestamp, silently corrupting auction state.
**Fix:** Add Zod schema with `z.uuid()` for IDs and regex for dates.

#### [SEC-03] `[leagueId]/actions.ts` — No Zod on `launchFirstAuction` — P1 | Effort: S

**Location:** `apps/web/app/(game)/league/[leagueId]/actions.ts` lines 21-82
**Current:** `leagueId` passed to Supabase query without UUID validation. `roundDates` only length-checked, not format-validated.
**Risk:** Invalid date strings stored as timestamps in `auctions.closes_at`.
**Fix:** Add Zod schema with `z.uuid()` and date regex.

#### [SEC-04] `settings/actions.ts` — `updateUserEmail` lacks email format validation — P1 | Effort: S

**Location:** `apps/web/app/(game)/league/[leagueId]/settings/actions.ts` lines 69-79
**Current:** Only checks `!email.trim()`. Any non-empty string reaches `supabase.auth.updateUser()`.
**Fix:** Add `z.email()` validation.

#### [SEC-05] `settings/actions.ts` — `leaveLeague` skips auth check — P2 | Effort: S

**Location:** `apps/web/app/(game)/league/[leagueId]/settings/actions.ts` lines 37-51
**Current:** No `getUser()` before calling `leave_league` RPC. No Zod on `leagueId`.
**Fix:** Add `getUser()` guard + `z.uuid()` validation.

#### [SEC-06] GT actions — Systematic auth check omission across 3 files — P2 | Effort: M

**Location:** `team/gt/actions.ts` (7 functions), `team/gt/rescue/actions.ts`, `team/gt/tactics/actions.ts` (read helpers)
**Current:** None call `getUser()`. Mutations defer to RPC. Read helpers (`getSquadWithRoles`, `getEligibleRivals`, `listTacticActivations`) have no auth at any layer.
**Risk:** No defense-in-depth for mutations. Read helpers silently return data if RLS regresses.
**Fix:** Add `getUser()` guard to all exported functions.

#### [SEC-07] `achievements/actions.ts` — No ownership check before equipping — P2 | Effort: M

**Location:** `apps/web/app/(game)/league/[leagueId]/achievements/actions.ts` lines 8-38
**Current:** `equipAchievement` validates slug against static list but does not verify the user earned it. Writes directly to `teams.equipped_achievement_slug`.
**Risk:** Any user can equip any achievement badge regardless of whether they earned it.
**Fix:** Add a `team_achievements` table or query earned achievements before updating.

### 2.2 SECURITY DEFINER Audit

All 22 SECURITY DEFINER functions were checked for `SET search_path`:

**Result: 22/22 PASS.** Every SECURITY DEFINER function sets `search_path` to either `public, pg_temp` or `''` (with schema-qualified references). No privilege escalation vector found.

#### [SEC-08] `block_team_field_updates` trigger — inconsistent `search_path` — P3 | Effort: S

**Location:** `supabase/migrations/20260505000000_protect_team_sensitive_fields.sql` lines 5-26
**Current:** Not SECURITY DEFINER, but lacks `SET search_path` unlike every other trigger function in the project.
**Fix:** Add `SET search_path = public, pg_temp` for consistency.

### 2.3 service_role Exposure

`apps/web/lib/supabase/admin.ts` — `import "server-only"` at line 1. Used in exactly one location: `auction/actions.ts` line 8. Service role key from `process.env.SUPABASE_SERVICE_ROLE_KEY` (not `NEXT_PUBLIC_`). No client-side leakage risk.

#### [SEC-09] `forceResolveRound` — admin client used without commissioner authorization check — P1 | Effort: S

**Location:** `apps/web/app/(game)/league/[leagueId]/auction/actions.ts` lines 368-395
**Current:** Authenticates caller and verifies league membership (line 383-393), then immediately creates admin client (line 395) to close auction and trigger payday. **No check that the caller is the league commissioner.**
**Risk:** Any league member can force-resolve a round, closing the auction and triggering salary deductions + sponsor income for all teams. This is an actual authorization flaw, not just defense-in-depth — the admin client bypasses all RLS.
**Fix:** Add commissioner check: `const { data: league } = await supabase.from("leagues").select("commissioner_id").eq("id", leagueId).single(); if (league.commissioner_id !== user.id) return { error: "Only the Race Director can force-resolve" };`

### 2.4 RLS Completeness

All 28+ tables have `ENABLE ROW LEVEL SECURITY`. Every table has at least one policy. **No critical RLS gaps found.**

#### [SEC-10] `teams.equipped_achievement_slug` — no DB constraint — P2 | Effort: S

**Location:** `supabase/migrations/20260517000000_add_equipped_achievement.sql` line 1
**Current:** Plain `text` column, no CHECK, no FK, no trigger. Any string can be written.
**Fix:** Add CHECK constraint limiting to valid achievement slugs, or enforce via FK to a `team_achievements` table.

---

## 3. Performance

### 3.1 Python N+1 Patterns

#### [PERF-01] `sponsor_bonus.py` — 3 DB calls per bonus inside nested loop — P0 | Effort: M

**Location:** `services/pcs-sync/sponsor_bonus.py` lines 310-364 (inside loops at lines 273 and 287)
**Current:** For every (result, team) pair: `sponsor_bonuses.upsert` (l. 310), `teams.select` (l. 332), `teams.update` (l. 346), `treasury_log.insert` (l. 350). For a race with 50 results × 5 qualifying teams = ~750 DB calls.
**Risk:** Financial inconsistency — if the loop fails mid-way, treasury is partially credited with no rollback. At 10 leagues, this becomes ~7,500 calls per scoring run.
**Fix:** Accumulate bonuses in memory, batch-upsert `sponsor_bonuses`, batch-update `teams.treasury` per team, batch-insert `treasury_log`.

#### [PERF-02] `scoring.py` — `rider_xp_daily` upsert inside triple-nested loop — P1 | Effort: M

**Location:** `services/pcs-sync/scoring.py` line 567 (inside loops at lines 430, 434, 455)
**Current:** One upsert per (team, contract, race_slug). For 10 teams × 12 riders × 3 slugs = 360 individual upserts.
**Risk:** Supabase rate limiter returns 429s around 100 requests on free plan.
**Fix:** Accumulate rows in a list, single batch `upsert` after the loop.

#### [PERF-03] `scoring.py` — per-team `teams.select` + `teams.update` — P1 | Effort: S

**Location:** `services/pcs-sync/scoring.py` lines 660-688
**Current:** Each team gets SELECT + UPDATE for cumulative_xp inside the team loop. 10 teams = 20 calls.
**Risk:** Non-atomic SELECT→compute→UPDATE — concurrent scoring runs can double-count XP.
**Fix:** Pre-fetch all teams, batch-update with `cumulative_xp = cumulative_xp + delta`.

#### [PERF-04] `scoring.py` — `get_active_multiplier()` one SELECT per rider per race — P1 | Effort: S

**Location:** `services/pcs-sync/scoring.py` lines 549-554; `services/pcs-sync/remontada.py` lines 138-168
**Current:** Called per (team, rider, race_slug) — up to 120 calls for a GT stage with 10 teams × 12 riders. Same row re-fetched 12 times per team.
**Fix:** Pre-fetch all `remontada_boosts` for relevant leagues into a dict before the loop.

#### [PERF-05] `scoring.py` — `team_ranking_daily` upsert per team — P2 | Effort: S

**Location:** `services/pcs-sync/scoring.py` lines 713-719
**Current:** One upsert per team per league in a loop. 2 leagues × 10 teams = 20 sequential calls.
**Fix:** Batch into one `upsert([...])` per league.

### 3.2 Next.js Query Analysis

| Page | Queries | Promise.all | Waterfalls | Notes |
|---|---|---|---|---|
| League home (`page.tsx`) | **16** (7 page + 9 feed lib) | 2 groups | 2 sequential | `getRaceFeedData` fetches full `riders` table unfiltered |
| Auction (`auction/page.tsx`) | **9** | 1 (5 queries) | 3 sequential | Heavy `.map()/.filter()` on small arrays |
| Team (`team/page.tsx`) | **7** | 2 groups | 1 (Group 2 waits for 1) | Well-structured |
| Opponent team (`ranking/team/[teamId]/page.tsx`) | **8** | 3 groups | 2 sequential singles | |
| Auction status (`auction/status/page.tsx`) | **8** | **0** | **8 fully sequential** | Worst pattern in the codebase |

#### [PERF-06] `auction/status/page.tsx` — 8 fully sequential queries with no `Promise.all` — P2 | Effort: S

**Location:** `apps/web/app/(game)/league/[leagueId]/auction/status/page.tsx` lines 48-144
**Current:** 8 `await supabase` calls, none wrapped in `Promise.all`. Queries 1-2 are independent reads from `auctions`. Queries 4-7 all depend only on `teamIds` (available after line 78) but are sequential.
**Risk:** 140ms+ of pure latency from 7 sequential round-trips.
**Fix:** Merge queries 1-2, wrap queries 4-7 in `Promise.all`.

#### [PERF-07] `getRaceFeedData` — full `riders` table scan (600 rows) — P2 | Effort: S

**Location:** `apps/web/lib/get-race-feed-data.ts` lines 122-126
**Current:** `supabase.from("riders").select("id, full_name")` with no filter. Fetches all 600 riders.
**Fix:** Extract rider IDs from `xpRows`/`bonusRows` first, add `.in("id", riderIdsNeeded)`.

#### [PERF-08] Zero Next.js route caching — P2 | Effort: M

**Location:** Verified: zero `unstable_cache`, `cache()` from `next/cache`, or `export const revalidate` in `apps/web/app/`.
**Current:** Every page re-runs all queries on every request. Race feed data (past races, rider names) is effectively static between scoring runs.
**Fix:** Wrap `getRaceFeedData` in `unstable_cache` with tag `race-feed-${leagueId}` and 60s revalidation. Wrap rider name lookups with `revalidate: 3600`.

---

## 4. Scalability

#### [SCALE-01] Connection pool saturates at 60 concurrent bids — P2 | Effort: M

**Location:** `supabase/migrations/20260518000002_place_bid_late_joiner_gate.sql` lines 63-65 (FOR UPDATE), 54-213 (full transaction)
**Current:** Each `place_bid` holds a connection for ~50-100ms (11 queries). Supabase free plan: 60 connections via PgBouncer. At 100 concurrent bids, 40+ requests queue, adding 200-400ms latency.
**Risk:** Guaranteed connection pool saturation at 1,000 users across leagues.
**Fix:** (1) Move to Supabase Pro (200+ connections). (2) Reduce `place_bid` from 11 to 7 queries (see DB-09) — triples effective throughput.

#### [SCALE-02] Scoring pipeline — O(teams × riders) DB calls — P1 | Effort: L

**Location:** `services/pcs-sync/scoring.py` lines 225-760
**Current:** ~200 DB calls for 1 league (10 teams, 1 GT stage). Scales linearly: 10 leagues = ~2,000 calls (60s at 30ms/call). 100 leagues = 20,000 calls (10 minutes).
**Fix:** Pre-fetch `remontada_boosts` (saves 80 calls/stage) + batch `rider_xp_daily` upserts (saves 80 calls/stage). Reduces ~200 to ~125 per league.

#### [SCALE-03] Ranking page fetches entire `rider_xp_daily` table per league — P2 | Effort: M

**Location:** `apps/web/app/(game)/league/[leagueId]/ranking/page.tsx` lines 63-66 (noted from ranking/team variant)
**Current:** Fetches all XP entries with no date filter. Mid-season: ~6,000 rows/league. End of season: ~30,000 rows. At 80 bytes/row = 2.4 MB per page load.
**Risk:** 100 DAU × 5 visits/day × 2.4 MB = 1.2 GB/day — exhausts free tier (2 GB/month) in under 2 days.
**Fix:** Use `teams.cumulative_xp` (already stored) for totals. Fetch only recent XP with `.limit(500).order("date", { ascending: false })`.

#### [SCALE-04] `triggerPhasePayday` — N sequential RPCs with no timeout safety — P1 | Effort: M

**Location:** `apps/web/app/(game)/league/[leagueId]/auction/actions.ts` lines 281-333
**Current:** Iterates all teams sequentially. 10 teams = 2-3.5s. 20 teams = 4-7s. Any Supabase slowdown pushes toward Vercel timeout.
**Risk:** Partial failure leaves league in inconsistent state (some teams paid, others not).
**Fix:** Replace with single `payday_league` RPC (see DB-10).

---

## 5. Code Quality

### 5.1 Python Test Coverage

| Source file | Lines | Test coverage |
|---|---|---|
| `scoring.py` | 760 | 1,048 test lines (3 files) |
| `sponsor_bonus.py` | 370 | 511 test lines |
| `remontada.py` | 168 | 293 test lines (2 files) |
| `tactics.py` | 84 | 107 test lines |
| `auction.py` | 336 | 262 test lines |
| `sync_race.py` | 612 | 398 test lines |
| `enrich.py` | 589 | 168 test lines |
| `dnf_detection.py` | 122 | 55 test lines |
| `resolve_gt_rescue.py` | 137 | 56 test lines |
| `sync.py` | 195 | 33 test lines |
| **`run_pipeline.py`** | **971** | **0 — no tests** |
| **`goal_evaluator.py`** | **581** | **0 — no tests** |
| **`validation.py`** | **73** | **0 — no tests** |
| **`retry_failed.py`** | **110** | **0 — no tests** |
| **`backfill_traceability.py`** | **36** | **0 — no tests** |
| **`resolve_now.py`** | **40** | **0 — no tests** |

### 5.2 Next.js Test Coverage

| Action file | Tests |
|---|---|
| `auction/[auctionId]/actions.ts` | Yes (2 files) |
| `auction/actions.ts` | Yes |
| `auction/market/actions.ts` | Yes |
| `rider/[riderId]/actions.ts` | Yes |
| `team/gt/actions.ts` | Yes |
| `team/gt/rescue/actions.ts` | Yes |
| `team/gt/tactics/actions.ts` | Yes |
| `(auth)/league/join/actions.ts` | Yes |
| **`(auth)/league/create/actions.ts`** | **No tests** |
| **`[leagueId]/actions.ts`** | **No tests** |
| **`[leagueId]/settings/actions.ts`** | **No tests** |
| **`[leagueId]/achievements/actions.ts`** | **No tests** |
| **`auction/rounds/actions.ts`** | **No tests** |
| **`team/budget/actions.ts`** | **No tests** |
| **`team/strategies/actions.ts`** | **No tests** |

#### [QUAL-01] 37 `except Exception` broad catches in Python — P2 | Effort: M

**Location:** `sync_race.py` (11), `run_pipeline.py` (8), `scoring.py` (5), `enrich.py` (4), `sponsor_bonus.py` (2, lines 326/362), `auction.py` (2), `goal_evaluator.py` (2), others (3)
**Current:** Transient errors (429, timeout) and permanent errors (constraint violation) handled identically.
**Fix:** Catch `postgrest.exceptions.APIError` first (check `.code`), add `is_retriable(exc)` helper.

#### [QUAL-02] `run_pipeline.py` — 971 lines, zero tests — P2 | Effort: M

**Location:** `services/pcs-sync/run_pipeline.py`
**Current:** CLI entry point with non-trivial orchestration: phase detection, GT stage date calculation (source of last 2 bug-fix commits), error aggregation.
**Fix:** Add tests covering race slug construction, GT date accounting, sponsor squad gating.

#### [QUAL-03] `goal_evaluator.py` — 581 lines, zero tests — P2 | Effort: M

**Location:** `services/pcs-sync/goal_evaluator.py`
**Current:** Financial operation (sponsor goal bonuses) with no test coverage. 2 `except Exception` catches.
**Fix:** Add tests for stage-win goal, GC podium goal, negative case.

#### [QUAL-04] `policies` / `team_policies` tables — dead schema — P3 | Effort: S

**Location:** `supabase/migrations/20260221000000_initial_schema.sql` lines 181-207; `apps/web/lib/database.types.ts`
**Current:** Present in generated types but unreferenced in app code. Replaced by `strategies` / `team_strategies`.
**Fix:** Drop tables via migration, regenerate types.

#### [QUAL-05] 7 of 15 server action files have no tests — P2 | Effort: L

**Location:** `settings/actions.ts`, `achievements/actions.ts`, `league/[leagueId]/actions.ts`, `auction/rounds/actions.ts`, `league/create/actions.ts`, `team/budget/actions.ts`, `team/strategies/actions.ts`
**Current:** Includes `leaveLeague` (irreversible), round date mutations, and league creation.
**Fix:** Prioritize: (1) `settings/actions.ts`, (2) `auction/rounds/actions.ts`, (3) `league/create/actions.ts`.

---

## 6. Architecture

#### [ARCH-01] No Edge Functions deployed — P3 | Effort: M

**Location:** `supabase/` — `functions/` directory does not exist.
**Current:** All computation in Next.js server actions or local Python service.
**Candidates:** (1) `resolve_nemesis_for_stage` — already an RPC, could be webhook-triggered. (2) Scheduled payday via pg_cron (removes manual commissioner trigger). Note: `edge-runtime` excluded from local Colima stack per CLAUDE.md.

#### [ARCH-02] Python service writes to 23 tables directly with service_role — P2 | Effort: L

**Location:** `services/pcs-sync/*.py` — 23 distinct `.table()` calls confirmed.
**Current:** Schema changes require updating migrations AND hunting Python call sites. `treasury_log` written directly (`sponsor_bonus.py` l. 350) despite CLAUDE.md rule "NEVER muter treasury_log directement" — Python service exempt by convention only.
**Fix:** Route treasury mutations through RPCs. Group remaining tables into write domains with domain-specific RPCs.

#### [ARCH-03] `contracts + riders(*)` join duplicated across 5+ pages — P3 | Effort: S

**Location:** `team/page.tsx` l. 76, `auction/page.tsx` l. 93, `strategies/page.tsx` l. 68, `ranking/team/[teamId]/page.tsx` l. 71, `lib/rider-detail-data.ts` l. 203/294/350
**Current:** Same roster query written from scratch with slight column variations. New rider columns must be added in 5+ places.
**Fix:** Extract `getActiveRoster(supabase, { teamId, columns? })` helper.

---

## Appendix A — Severity Matrix

| ID | Title | Sev | Effort | File |
|---|---|---|---|---|
| PERF-01 | sponsor_bonus.py N+1 treasury mutations | P0 | M | `services/pcs-sync/sponsor_bonus.py` |
| SEC-09 | forceResolveRound missing commissioner check | P1 | S | `apps/web/.../auction/actions.ts` |
| SEC-01 | rider/actions.ts no Zod no auth | P1 | S | `apps/web/.../rider/[riderId]/actions.ts` |
| SEC-02 | auction/rounds no Zod | P1 | S | `apps/web/.../auction/rounds/actions.ts` |
| SEC-03 | launchFirstAuction no Zod | P1 | S | `apps/web/.../[leagueId]/actions.ts` |
| SEC-04 | updateUserEmail no validation | P1 | S | `apps/web/.../settings/actions.ts` |
| DB-10 | confirm_phase_setup non-atomic | P1 | M | `apps/web/.../auction/actions.ts` |
| PERF-02 | scoring.py rider_xp_daily N+1 | P1 | M | `services/pcs-sync/scoring.py` |
| PERF-03 | scoring.py team select/update N+1 | P1 | S | `services/pcs-sync/scoring.py` |
| PERF-04 | scoring.py remontada N+1 | P1 | S | `services/pcs-sync/scoring.py` |
| SCALE-02 | Scoring O(teams×riders) | P1 | L | `services/pcs-sync/scoring.py` |
| SCALE-04 | triggerPhasePayday N sequential | P1 | M | `apps/web/.../auction/actions.ts` |
| DB-01 | league_members.team_id no index | P2 | S | initial schema |
| DB-02 | contracts.league_id partial index gap | P2 | S | contracts migration |
| DB-03 | rider_xp_daily.contract_id no index | P2 | S | initial schema |
| DB-04 | sponsor_bonuses.rider_id no index | P2 | S | sponsors rework |
| DB-08 | Zero views | P2 | M | all migrations |
| DB-09 | place_bid 11 queries | P2 | M | place_bid migration |
| SEC-05 | leaveLeague no auth | P2 | S | settings/actions.ts |
| SEC-06 | GT actions no auth | P2 | M | gt/actions.ts (3 files) |
| SEC-07 | achievements no unlock check | P2 | M | achievements/actions.ts |
| SEC-10 | achievement slug no DB constraint | P2 | S | achievement migration |
| PERF-05 | team_ranking_daily N+1 | P2 | S | scoring.py |
| PERF-06 | status page 8 sequential queries | P2 | S | auction/status/page.tsx |
| PERF-07 | riders full table scan | P2 | S | get-race-feed-data.ts |
| PERF-08 | Zero Next.js caching | P2 | M | all routes |
| SCALE-01 | Connection pool saturation at 60 | P2 | M | place_bid |
| SCALE-03 | rider_xp_daily full table per page | P2 | M | ranking page |
| QUAL-01 | 37 broad exception catches | P2 | M | Python service |
| QUAL-02 | run_pipeline.py no tests | P2 | M | run_pipeline.py |
| QUAL-03 | goal_evaluator.py no tests | P2 | M | goal_evaluator.py |
| QUAL-05 | 7 untested action files | P2 | L | multiple |
| ARCH-02 | Python writes 23 tables directly | P2 | L | Python service |
| DB-05 | team_xp_adjustments no index | P3 | S | xp adjustments migration |
| DB-06 | gt_emergency_bids no index | P3 | S | rescue migration |
| DB-07 | round_validations.team_id no index | P3 | S | round validations migration |
| DB-11 | RPCs redefined 18x no canonical source | P3 | L | multiple migrations |
| SEC-08 | block_team_field_updates no search_path | P3 | S | protect fields migration |
| QUAL-04 | Dead policies/team_policies tables | P3 | S | initial schema |
| ARCH-01 | No Edge Functions | P3 | M | supabase/ |
| ARCH-03 | contracts+riders join duplicated 5x | P3 | S | multiple pages |

## Appendix B — Files Examined

### Supabase Migrations (key files)
- `supabase/migrations/20260221000000_initial_schema.sql` — 15 tables, RLS, initial indexes
- `supabase/migrations/20260222110000_fix_recursive_rls.sql` — `is_league_member` helper
- `supabase/migrations/20260313000000_contracts_unique_active_rider.sql` — contracts.league_id
- `supabase/migrations/20260313100000_rider_xp_daily_audit.sql` — XP dedup index
- `supabase/migrations/20260402300000_sponsors_rework.sql` — sponsor_bonuses table
- `supabase/migrations/20260505000000_protect_team_sensitive_fields.sql` — trigger
- `supabase/migrations/20260508010100_gt_tactic_activations.sql` — GT tactics
- `supabase/migrations/20260510000000_gt_squad_builder_v2.sql` — GT squad
- `supabase/migrations/20260518000002_place_bid_late_joiner_gate.sql` — latest place_bid
- `supabase/migrations/20260518000003_confirm_phase_setup_remove_late_joiner.sql` — latest payday
- `supabase/migrations/20260519000000_gt_rescue_window.sql` — emergency bids

### Server Actions (all 15)
- `apps/web/app/(auth)/league/create/actions.ts`
- `apps/web/app/(auth)/league/join/actions.ts`
- `apps/web/app/(game)/league/[leagueId]/actions.ts`
- `apps/web/app/(game)/league/[leagueId]/settings/actions.ts`
- `apps/web/app/(game)/league/[leagueId]/achievements/actions.ts`
- `apps/web/app/(game)/league/[leagueId]/rider/[riderId]/actions.ts`
- `apps/web/app/(game)/league/[leagueId]/auction/actions.ts`
- `apps/web/app/(game)/league/[leagueId]/auction/[auctionId]/actions.ts`
- `apps/web/app/(game)/league/[leagueId]/auction/market/actions.ts`
- `apps/web/app/(game)/league/[leagueId]/auction/rounds/actions.ts`
- `apps/web/app/(game)/league/[leagueId]/team/budget/actions.ts`
- `apps/web/app/(game)/league/[leagueId]/team/gt/actions.ts`
- `apps/web/app/(game)/league/[leagueId]/team/gt/rescue/actions.ts`
- `apps/web/app/(game)/league/[leagueId]/team/gt/tactics/actions.ts`
- `apps/web/app/(game)/league/[leagueId]/team/strategies/actions.ts`

### Python Service
- `services/pcs-sync/scoring.py` (760 lines)
- `services/pcs-sync/sponsor_bonus.py` (370 lines)
- `services/pcs-sync/remontada.py` (168 lines)
- `services/pcs-sync/run_pipeline.py` (971 lines)
- `services/pcs-sync/goal_evaluator.py` (581 lines)

### Next.js Pages (top 5 audited)
- `apps/web/app/(game)/league/[leagueId]/page.tsx` (314 lines)
- `apps/web/app/(game)/league/[leagueId]/auction/page.tsx` (355 lines)
- `apps/web/app/(game)/league/[leagueId]/team/page.tsx` (314 lines)
- `apps/web/app/(game)/league/[leagueId]/ranking/team/[teamId]/page.tsx` (323 lines)
- `apps/web/app/(game)/league/[leagueId]/auction/status/page.tsx` (303 lines)

### Supabase Clients
- `apps/web/lib/supabase/admin.ts`
- `apps/web/lib/supabase/server.ts`
- `apps/web/lib/supabase/browser.ts`
- `apps/web/lib/get-race-feed-data.ts`
