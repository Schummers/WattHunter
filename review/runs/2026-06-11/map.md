# WattHunter — Codebase Map

## Entry Points

### Web App (Next.js 16 App Router — `apps/web/`)
| Route Group | Path | Purpose |
|---|---|---|
| `(auth)` | `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/onboarding`, `/league/create`, `/league/join`, `/league/choose` | Auth + league onboarding flows |
| `(lobby)` | `/lobby/[leagueId]` | Pre-game lobby (pending leagues, 3 tabs: Lobby / Level & Pool / Rules) |
| `(game)` | `/league/[leagueId]` | Full game shell — home feed, auction, team, ranking, rider detail, GT, achievements, settings |
| `(legal)` | `/privacy`, `/terms` | Static legal pages |
| `api/admin/revalidate-demo` | POST `/api/admin/revalidate-demo` | Bearer-token-protected ISR cache revalidation for demo league (no DB) |
| `auth/callback` | GET `/auth/callback` | Supabase auth PKCE exchange |

### Python Pipeline (local only — `services/pcs-sync/`)
| Entry | Command | Purpose |
|---|---|---|
| `run_pipeline.py` | `python run_pipeline.py <subcommand>` | CLI orchestrator for all pipeline steps |
| `run_pipeline.py::run_init_riders` | `init-riders` | Seed top 600 PCS riders (1×/year) |
| `run_pipeline.py::run_post_race` | `post-race --race <slug>` | Stage scrape → scoring → sponsor bonuses → goal evaluation |
| `run_pipeline.py::run_startlists` | `startlists --race <slug>` | Startlist import |
| `run_pipeline.py::run_enrich_riders` | `enrich-riders` | Photo, bio, specialty enrichment |
| `run_pipeline.py::run_evaluate_goals` | `evaluate-goals --race <slug>` | Goal evaluation only (re-runnable) |
| `run_pipeline.py::run_underdog_eligibility` | `underdog-eligibility` | Compute per-phase underdog eligibility flags |
| `resolve_now.py` | direct invocation | Resolve auction round immediately (mirrors `auction.py`) |

---

## Supabase Client Instantiation

| File | Key Used | Scope |
|---|---|---|
| `apps/web/lib/supabase/browser.ts:4` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client components (browser) — used only by auth pages and `settings-buttons.tsx` |
| `apps/web/lib/supabase/server.ts:8` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Server components + most server actions |
| `apps/web/lib/supabase/admin.ts:23` | `SUPABASE_SERVICE_ROLE_KEY` | Service-role; guarded by `import "server-only"`; used **only** by `forceResolveRound` in `auction/actions.ts` |
| `apps/web/lib/supabase/middleware.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Session refresh in middleware |
| `apps/web/app/auth/callback/route.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` (via `@supabase/ssr` inline) | Auth callback — creates its own `createServerClient` directly, bypasses `lib/supabase/server.ts` |
| `services/pcs-sync/sync.py` | `SUPABASE_SERVICE_ROLE_KEY` (env) | All Python pipelines (bypasses RLS — correct for server-side writes) |

Browser client importers (7 files): `(auth)/login`, `(auth)/signup`, `(auth)/forgot-password`, `(auth)/reset-password`, `(auth)/league/create`, `(auth)/league/join`, `(game)/settings/settings-buttons.tsx` — all auth/signout flows, no game mutations.

---

## Business Rules Location

| Layer | Where |
|---|---|
| Canonical game rules doc | `docs/GAME_RULES.md` |
| Salary formula (TS) | `apps/web/lib/format.ts:53-61` — `calcMinSalary`: `pts × 2000 / 12`, floor 5000, round down to 1000 |
| Salary formula (Python) | `services/pcs-sync/sync.py:56-60` — `calculate_monthly_salary`: same formula, maintained in parallel |
| Level pool gating (TS) | `apps/web/lib/levels.ts:2-9` — `LEVELS` array, `poolMin` per level |
| Level pool gating (Python) | `services/pcs-sync/sync.py:24` — `LEVEL_POOL_MIN = [300,200,100,30,20,10,4,1]` |
| Scoring (XP, role_mult, nemesis, underdog) | `services/pcs-sync/scoring.py` (Python, authoritative) |
| Tactics modifiers | `services/pcs-sync/tactics.py` (Python); UI mirror in `apps/web/lib/tactics.ts` |
| Sponsor bonus calc | `services/pcs-sync/sponsor_bonus.py` |
| GT goal evaluation | `services/pcs-sync/goal_evaluator.py` |
| No-cumul rule (§18) | `services/pcs-sync/sponsor_bonus.py` (pipeline); gated by `sponsor_goal_completions.neutralized_stage_slugs` |
| Auction resolution (Python) | `services/pcs-sync/auction.py` (canonical CLI path) |
| Auction resolution (TS port) | `apps/web/app/(game)/league/[leagueId]/auction/actions.ts:368-622` — `forceResolveRound` (consensus-triggered, uses `createAdminClient`) |
| DB-level invariants | Supabase RPCs + trigger `teams_protect_sensitive_fields` in migrations (68 migrations define SECURITY DEFINER functions) |
| Phase/payday | `apps/web/lib/phases.ts` (TS) + `confirm_phase_setup` RPC |

---

## Duplicated / Parallel Modules

### Critical: GT slug / squad-race classification helpers
Two independent copies of the same calendar-driven classification logic:
- **Canonical**: `services/pcs-sync/scoring.py` — `_stage_race_slug_prefixes`, `_is_squad_race`, `_is_gt_slug`
- **Copy**: `services/pcs-sync/run_pipeline.py:64,75,93` — `_is_gt_stage`, `_stage_race_slug_prefixes`, `_is_squad_race` re-implemented locally; does NOT import from `scoring.py`
- `goal_evaluator.py` correctly imports from `scoring.py`
- `sponsor_bonus.py` has its own `_is_grand_tour_slug` (GT-only) plus an inner `_is_gt_stage`

### Auction Resolution: Python + TS
- `services/pcs-sync/auction.py` — CLI, service-role, full resolution
- `apps/web/app/(game)/league/[leagueId]/auction/actions.ts:forceResolveRound` — TS server action, consensus-triggered; duplicates bid-sort, level-gating, contract creation, draft cleanup, payday cascade using `createAdminClient` against raw tables directly (39 `.from()` calls). Deliberate exception to the Zod→rpc pattern.

### Salary Formula: Python + TS
- `sync.py:56-60` and `format.ts:54-61` — identical formula, maintained separately

### LEVEL_POOL_MIN: Python + TS
- `sync.py:24` and `levels.ts:2-9` — same 8-entry list, maintained separately

---

## Architecture Notes
- **201 migrations** in `supabase/migrations/` as of 2026-06-05; many define SECURITY DEFINER functions.
- All server actions follow: Zod validation → `supabase.rpc(...)` → error forwarding, **except** `forceResolveRound` in `auction/actions.ts` which contains substantial inline business logic using the admin client directly — the one deliberate exception per codebase design.
- `apps/web/lib/supabase/admin.ts` has `import "server-only"` — build fails if a client component imports it.
- No direct `treasury_log` mutations in TS code; all treasury writes go through RPCs (`confirm_phase_setup`, `credit_sponsor_bonuses`, etc.) — rule respected.
- Only one external API route (`/api/admin/revalidate-demo`); all game mutations go through server actions or RPCs.
- Python test suite: `services/pcs-sync/tests/`; TS: `apps/web` with vitest.

---

## Pagination Coverage (PostgREST 1000-row cap)

`db_utils._fetch_all` is correctly used in `sponsor_bonus.py` and `goal_evaluator.py` for all large fetches (race_results, squad, roles, classifications, existing bonuses).

**`scoring.py` does NOT use `_fetch_all` for any of its fetches:**
- `contracts` — `scoring.py:434` — `.execute()` only. Could truncate in a large multi-league deployment.
- `team_strategies` — `scoring.py:453` — `.execute()` only.
- `gt_squad` — `scoring.py:499` — `.execute()` only. Scoped to `phase_id` + `year`; bounded in practice.
- `gt_daily_classifications` — `scoring.py:529` — `.execute()` only. Scoped to `squad_slugs`; bounded per stage-set.
- `gt_final_classifications` — `scoring.py:548` — `.execute()` only. Small dataset.
- `gt_tactic_activations` — `scoring.py:569` — `.execute()` only. Small dataset.
- `rider_xp_daily` (prev delta) — `scoring.py:426` — `.execute()` only. Scoped to `race_slugs`.
- `race_results` (history) — `scoring.py:377` and `383` — `.execute()` only. Scoped to `race_slugs`; Giro 2026 had 1573 rows which triggered the prior ITT payout miss in `goal_evaluator.py`.

**`goal_evaluator.py:451`**: `team_sponsors` fetched via single `.execute()` (not `_fetch_all`). Currently bounded (one sponsor per team), but would silently truncate if the league count exceeds 1000.

**`goal_evaluator.py:573`**: `sponsor_goal_completions` keyed by `race_slug` via single `.execute()`. Bounded per race; safe at current scale.

---

## Additional Server Action Compliance Notes

Actions that contain business logic in TS rather than delegating fully to an RPC:

| Action | File | Violation |
|---|---|---|
| `saveStrategies` | `team/strategies/actions.ts:22` | Unlock-level checks, immediate/pending mode, per-row upsert loop in TS |
| `saveSponsor` | `team/budget/actions.ts:20` | Sponsor level-unlock check and immediate/pending mode in TS |
| `createLeague` | `(auth)/league/create/actions.ts:18` | Multi-step league/team/sponsor/member inserts without a transaction RPC |
| `signupAndJoinLeague` | `(auth)/league/join/actions.ts:18` | Sponsor auto-assignment in TS after `join_league_by_code` RPC |
| `createNextPhaseAuctions` | `auction/rounds/actions.ts:106` | Paris-timezone offset computation + multi-row insert in TS |
| `cancelBid` | `auction/[auctionId]/actions.ts:40` | Direct `.update({status:'cancelled'})` on `auction_bids` — not an RPC, covered by RLS policy `auction_bids_update_own` |

`treasury_log` is never touched from TS — rule respected throughout.
